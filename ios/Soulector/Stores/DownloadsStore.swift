import AVFoundation
import Combine
import Foundation

// MARK: - State

/// Where an episode's audio is on its way to the device. Absence of a state is
/// `.notDownloaded`; `.failed` lives only for the session so a retry is always
/// one tap away without persisting dead entries.
enum DownloadState: Equatable {
    case notDownloaded
    /// Queued: caching the sidecars and resolving the stream URL.
    case waiting
    case downloading(Double)
    case downloaded
    case failed

    var isInFlight: Bool {
        switch self {
        case .waiting, .downloading: return true
        default:                     return false
        }
    }
}

// MARK: - On-disk shape

/// The sidecar for a downloaded episode: what the detail sheet renders. Audio
/// alone would leave a downloaded episode looking half-broken offline — no
/// tracklist, no album accent — so it's captured with the download.
struct OfflineEpisodeMetadata: Codable {
    let tracks: [EpisodeTrack]
    let accent: AccentColor?
}

/// One entry in the downloads manifest. The `Episode` is stored alongside the
/// bytes because the episodes list lives in the (system-evictable) caches
/// directory — downloads must still be findable after that's been purged.
private struct DownloadRecord: Codable {
    let episode: Episode
    var bytes: Int64
    var hasArtwork: Bool
    /// Where AVFoundation put the downloaded HLS bundle, relative to the app's
    /// home directory. It picks that location and owns what's in it — the
    /// bundle must never be moved — and the container path changes between
    /// launches, so the relative part is the only durable half.
    ///
    /// nil means the audio is a plain file this app placed itself: everything
    /// downloaded before SoundCloud dropped progressive streaming, plus
    /// MIXCLOUD episodes, which still come from a progressive archive mirror.
    var bundlePath: String?
    /// nil while the transfer is still in flight.
    var completedAt: Date?

    var isComplete: Bool { completedAt != nil }
}

private enum DownloadPaths {
    static let manifest = "manifest.json"

    static func audio(_ id: String, in dir: URL) -> URL { file(id, "mp3", dir) }
    static func artwork(_ id: String, in dir: URL) -> URL { file(id, "jpg", dir) }
    static func metadata(_ id: String, in dir: URL) -> URL { file(id, "json", dir) }

    /// The absolute location of an HLS bundle AVFoundation handed us. Resolved
    /// on every use rather than stored, because the app container is re-rooted
    /// on reinstall and across some OS updates.
    static func bundle(_ relativePath: String) -> URL {
        URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(relativePath)
    }

    /// Episode ids are Mongo hex strings today, but local-collective ids are
    /// free-form — keep them to characters that are safe in a file name.
    private static func file(_ id: String, _ ext: String, _ dir: URL) -> URL {
        let safe = String(id.map { $0.isLetter || $0.isNumber ? $0 : "-" })
        return dir.appendingPathComponent("\(safe).\(ext)")
    }
}

// MARK: - DownloadsStore

/// Owns offline copies of episodes: the audio, its artwork, and the metadata
/// the episode sheet needs. Transfers run on background sessions so a two-hour
/// mix keeps downloading with the app suspended or closed.
///
/// There are two of those sessions because there are two shapes of audio.
/// SoundCloud now only serves HLS, which can't be fetched as a file — pointing
/// a `downloadTask` at a playlist saves the manifest text and calls it a
/// success — so it goes through `AVAssetDownloadURLSession`, which downloads
/// the segments into a `.movpkg` bundle it places and owns. MIXCLOUD episodes
/// still resolve to a progressive file from the archive mirror and keep the
/// original path, which is also what every pre-HLS download on disk is.
@MainActor
final class DownloadsStore: ObservableObject {
    /// A singleton rather than a `@StateObject`, because iOS relaunches the app
    /// to hand back finished background transfers and expects the session — same
    /// identifier, same delegate — to be recreated from a place reachable
    /// outside the view tree (see `SoulectorApp.backgroundTask`).
    static let shared = DownloadsStore()

    /// Progressive file transfers. Unchanged from before HLS, deliberately: an
    /// upgrade mid-download still reconnects to whatever this session was doing.
    static let sessionIdentifier = "com.soulector.app.downloads"
    /// HLS. A separate identifier because a background session's persisted task
    /// state belongs to the kind of session that created it — handing the old
    /// identifier to `AVAssetDownloadURLSession` would ask it to adopt plain
    /// download tasks it can't represent.
    static let assetSessionIdentifier = "com.soulector.app.downloads.hls"

    /// Per-episode state, keyed by episode id. A missing key is `.notDownloaded`.
    @Published private(set) var states: [String: DownloadState] = [:]
    /// Completed downloads, newest release first.
    @Published private(set) var downloadedEpisodes: [Episode] = []
    /// Bytes on disk across every completed download.
    @Published private(set) var totalBytes: Int64 = 0

    private var records: [String: DownloadRecord] = [:]
    private let directory: URL
    private let delegate: DownloadsSessionDelegate
    private let session: URLSession
    private let assetSession: AVAssetDownloadURLSession
    private var backgroundEventsContinuation: CheckedContinuation<Void, Never>?

    /// Progress is published in steps, not per chunk: every change re-renders
    /// the list, and a 100 MB mix reports thousands of times.
    private static let progressPublishStep = 0.02

    private init() {
        directory = Self.makeDirectory()
        delegate = DownloadsSessionDelegate(directory: directory)

        // One serial queue behind both sessions, so the delegate can keep the
        // in-flight bundle locations in a plain dictionary.
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1

        session = URLSession(
            configuration: Self.makeConfiguration(identifier: Self.sessionIdentifier),
            delegate: delegate,
            delegateQueue: queue
        )
        // AVAssetDownloadURLSession requires a background configuration — it
        // rejects anything else — and refuses the standard task-creation
        // methods, which is why it can't just replace the session above.
        assetSession = AVAssetDownloadURLSession(
            configuration: Self.makeConfiguration(identifier: Self.assetSessionIdentifier),
            assetDownloadDelegate: delegate,
            delegateQueue: queue
        )

        delegate.store = self
        loadManifest()
        Task { await reconcileWithSession() }
    }

    private static func makeConfiguration(identifier: String) -> URLSessionConfiguration {
        let config = URLSessionConfiguration.background(withIdentifier: identifier)
        // The user asked for this mix by name, so don't let the system defer it
        // to a "convenient" moment — and don't second-guess their data plan.
        // Downloads always start from the foreground, which is what a
        // non-discretionary background transfer requires.
        config.isDiscretionary = false
        config.allowsCellularAccess = true
        config.sessionSendsLaunchEvents = true
        return config
    }

    // MARK: Reading

    func state(for episodeId: String) -> DownloadState {
        states[episodeId] ?? .notDownloaded
    }

    func isDownloaded(_ episodeId: String) -> Bool {
        state(for: episodeId) == .downloaded
    }

    var isEmpty: Bool { downloadedEpisodes.isEmpty }

    var formattedTotalSize: String {
        ByteCountFormatter.string(fromByteCount: totalBytes, countStyle: .file)
    }

    /// What one episode is costing on disk; nil until it's finished landing.
    func formattedSize(for episodeId: String) -> String? {
        guard let record = records[episodeId], record.isComplete, record.bytes > 0 else { return nil }
        return ByteCountFormatter.string(fromByteCount: record.bytes, countStyle: .file)
    }

    /// The local audio, when a complete copy is on disk. Either an HLS bundle
    /// AVFoundation is holding for us or a plain file we placed — both play
    /// through `AVURLAsset`, so callers don't have to care which.
    func audioURL(for episodeId: String) -> URL? {
        guard let record = records[episodeId], record.isComplete else { return nil }
        return Self.audioLocation(for: episodeId, record: record, in: directory)
    }

    private static func audioLocation(
        for episodeId: String, record: DownloadRecord, in directory: URL
    ) -> URL? {
        let url = record.bundlePath.map(DownloadPaths.bundle)
            ?? DownloadPaths.audio(episodeId, in: directory)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    /// The cached album art. Available as soon as the sidecars land, before the
    /// audio finishes, so a downloading episode already renders from disk.
    func artworkURL(for episodeId: String) -> URL? {
        guard records[episodeId]?.hasArtwork == true else { return nil }
        return DownloadPaths.artwork(episodeId, in: directory)
    }

    func cachedMetadata(for episodeId: String) -> OfflineEpisodeMetadata? {
        guard records[episodeId] != nil,
              let data = try? Data(contentsOf: DownloadPaths.metadata(episodeId, in: directory))
        else { return nil }
        return try? JSONDecoder().decode(OfflineEpisodeMetadata.self, from: data)
    }

    // MARK: Writing

    func download(_ episode: Episode) {
        guard episode.isStreamable else { return }
        let id = episode.id
        let current = state(for: id)
        guard current == .notDownloaded || current == .failed else { return }

        records[id] = DownloadRecord(
            episode: episode, bytes: 0, hasArtwork: false, bundlePath: nil, completedAt: nil
        )
        setState(.waiting, for: id)
        persistManifest()

        Task { await start(episode) }
    }

    /// Cancels an in-flight download or deletes a finished one — from the
    /// listener's side "Cancel Download" and "Remove Download" are the same
    /// thing: this episode should stop taking up space.
    func remove(_ episodeId: String) {
        let bundlePath = records[episodeId]?.bundlePath
        records[episodeId] = nil
        setState(.notDownloaded, for: episodeId)
        removeFiles(for: episodeId, bundlePath: bundlePath)
        persistManifest()
        refreshDerived()

        Task {
            for task in await allTasks() where task.taskDescription == episodeId {
                task.cancel()
            }
        }
    }

    private func start(_ episode: Episode) async {
        let id = episode.id
        // The sidecars ride along; the audio is what the user is waiting for.
        Task { await cacheSidecars(for: episode) }

        do {
            guard let urls = try await APIClient.shared.fetchStreamUrl(episodeId: id),
                  let url = URL(string: urls.streamUrl)
            else {
                markFailed(id)
                return
            }
            guard state(for: id) == .waiting else { return }

            // Survives app relaunch, and is how the delegate knows whose audio
            // it just received.
            let task: URLSessionTask
            if urls.isPlaylist {
                let configuration = AVAssetDownloadConfiguration(
                    asset: AVURLAsset(url: url), title: episode.name
                )
                task = assetSession.makeAssetDownloadTask(downloadConfiguration: configuration)
            } else {
                task = session.downloadTask(with: url)
            }
            task.taskDescription = id
            task.resume()
            setState(.downloading(0), for: id)
        } catch {
            markFailed(id)
        }
    }

    /// Artwork, tracklist and album accent. Best effort — the audio is the
    /// promise, these just keep the episode looking like itself offline.
    private func cacheSidecars(for episode: Episode) async {
        let id = episode.id

        let tracks = (try? await APIClient.shared.fetchTracks(episodeId: id)) ?? []
        let accent = try? await APIClient.shared.fetchAccentColor(episodeId: id)
        // Everything past an `await` re-checks the record: the download may have
        // been cancelled while we were fetching, and files it left behind would
        // outlive it.
        guard records[id] != nil else { return }
        if let data = try? JSONEncoder().encode(OfflineEpisodeMetadata(tracks: tracks, accent: accent)) {
            try? data.write(to: DownloadPaths.metadata(id, in: directory), options: .atomic)
        }

        guard let artworkUrl = URL(string: episode.artworkUrl),
              let (data, _) = try? await URLSession.shared.data(from: artworkUrl),
              records[id] != nil
        else { return }
        do {
            try data.write(to: DownloadPaths.artwork(id, in: directory), options: .atomic)
            records[id]?.hasArtwork = true
            persistManifest()
        } catch {
            // No artwork cached; the remote URL still serves it when online.
        }
    }

    // MARK: Session callbacks (main actor, called from the delegate)

    fileprivate func updateProgress(episodeId: String, progress: Double) {
        guard state(for: episodeId).isInFlight else { return }
        if case .downloading(let published) = state(for: episodeId),
           abs(progress - published) < Self.progressPublishStep, progress < 1 {
            return
        }
        setState(.downloading(min(1, max(0, progress))), for: episodeId)
    }

    /// `bundlePath` is set only for HLS: it's AVFoundation's chosen location for
    /// the `.movpkg`, relative to the app's home directory.
    fileprivate func finishDownload(episodeId: String, bytes: Int64, bundlePath: String? = nil) {
        guard var record = records[episodeId] else {
            // Removed while the transfer was in flight — don't leave the audio behind.
            removeFiles(for: episodeId, bundlePath: bundlePath)
            return
        }
        record.bytes = bytes
        record.bundlePath = bundlePath
        record.completedAt = Date()
        records[episodeId] = record
        setState(.downloaded, for: episodeId)
        persistManifest()
        refreshDerived()
    }

    fileprivate func failDownload(episodeId: String) {
        markFailed(episodeId)
    }

    fileprivate func backgroundSessionDidFinishEvents() {
        backgroundEventsContinuation?.resume()
        backgroundEventsContinuation = nil
    }

    /// Awaited by the app's `backgroundTask(.urlSession:)` handler: iOS woke us
    /// to deliver finished transfers and expects us to stay alive until the
    /// session says it has handed everything over.
    func handleBackgroundSessionEvents() async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            backgroundEventsContinuation?.resume()
            backgroundEventsContinuation = continuation
        }
    }

    private func markFailed(_ episodeId: String) {
        // No record means the user already removed it; a late failure from a
        // cancelled transfer isn't news.
        guard let record = records[episodeId] else { return }
        records[episodeId] = nil
        removeFiles(for: episodeId, bundlePath: record.bundlePath)
        setState(.failed, for: episodeId)
        persistManifest()
        refreshDerived()
    }

    private func setState(_ state: DownloadState, for episodeId: String) {
        if state == .notDownloaded {
            states[episodeId] = nil
        } else {
            states[episodeId] = state
        }
    }

    private func refreshDerived() {
        let complete = records.values.filter(\.isComplete)
        downloadedEpisodes = complete
            .map(\.episode)
            .sorted { ($0.releasedAtDate ?? .distantPast) > ($1.releasedAtDate ?? .distantPast) }
        totalBytes = complete.reduce(0) { $0 + $1.bytes }
    }

    // MARK: Persistence

    private static func makeDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        var dir = base.appendingPathComponent("Downloads", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        // Re-downloadable content must stay out of iCloud/iTunes backups.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? dir.setResourceValues(values)
        return dir
    }

    private func loadManifest() {
        if let data = try? Data(contentsOf: directory.appendingPathComponent(DownloadPaths.manifest)),
           let decoded = try? JSONDecoder().decode([String: DownloadRecord].self, from: data) {
            // Drop anything whose audio went missing under us — including an
            // HLS bundle the system evicted to reclaim space, which it may do
            // to downloaded assets under storage pressure.
            records = decoded.filter { id, record in
                guard record.isComplete else { return true }
                return Self.audioLocation(for: id, record: record, in: directory) != nil
            }
            for (id, record) in records where record.isComplete {
                states[id] = .downloaded
            }
        }
        // Runs even when there was no readable manifest — that's exactly when
        // the folder is most likely holding files nothing points at any more.
        pruneOrphanFiles()
        refreshDerived()
    }

    /// Anything in the folder the manifest doesn't account for — a sidecar whose
    /// audio never landed, leftovers from a crash — is dead weight. Scoped to
    /// our own folder: HLS bundles live in AVFoundation's managed store, which
    /// isn't ours to sweep.
    private func pruneOrphanFiles() {
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: nil
        ) else { return }

        var keep: Set<String> = [DownloadPaths.manifest]
        for id in records.keys {
            keep.insert(DownloadPaths.audio(id, in: directory).lastPathComponent)
            keep.insert(DownloadPaths.artwork(id, in: directory).lastPathComponent)
            keep.insert(DownloadPaths.metadata(id, in: directory).lastPathComponent)
        }
        for url in contents where !keep.contains(url.lastPathComponent) {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private func persistManifest() {
        guard let data = try? JSONEncoder().encode(records) else { return }
        try? data.write(to: directory.appendingPathComponent(DownloadPaths.manifest), options: .atomic)
    }

    /// Deleting a download means deleting whichever shape of audio it has, plus
    /// its sidecars. The bundle path has to be read off the record *before* the
    /// record is dropped, so callers pass it in.
    private func removeFiles(for episodeId: String, bundlePath: String?) {
        var urls = [
            DownloadPaths.audio(episodeId, in: directory),
            DownloadPaths.artwork(episodeId, in: directory),
            DownloadPaths.metadata(episodeId, in: directory),
        ]
        if let bundlePath { urls.append(DownloadPaths.bundle(bundlePath)) }
        for url in urls {
            try? FileManager.default.removeItem(at: url)
        }
    }

    /// Picks up whatever the background session was doing while we weren't
    /// running: live transfers keep their progress, records with nothing behind
    /// them surface as failed so they can be retried rather than sit forever.
    private func reconcileWithSession() async {
        var live = Set<String>()
        for task in await allTasks() {
            guard let id = task.taskDescription, records[id] != nil else {
                task.cancel()
                continue
            }
            live.insert(id)
            guard state(for: id) != .downloaded else { continue }
            setState(.downloading(Self.restoredProgress(of: task)), for: id)
        }

        for (id, record) in records where !record.isComplete && !live.contains(id) {
            // Something we kicked off this launch hasn't reached the session yet.
            guard state(for: id) != .waiting else { continue }
            markFailed(id)
        }
    }

    /// An asset download's byte counts stay at zero — its progress is measured
    /// in playable time, which AVFoundation folds into `Progress` for us.
    private static func restoredProgress(of task: URLSessionTask) -> Double {
        if task is AVAssetDownloadTask {
            return task.progress.fractionCompleted
        }
        let expected = task.countOfBytesExpectedToReceive
        return expected > 0 ? Double(task.countOfBytesReceived) / Double(expected) : 0
    }

    private func allTasks() async -> [URLSessionTask] {
        async let files = Self.tasks(in: session)
        async let assets = Self.tasks(in: assetSession)
        return await files + assets
    }

    private static func tasks(in session: URLSession) async -> [URLSessionTask] {
        await withCheckedContinuation { continuation in
            session.getAllTasks { continuation.resume(returning: $0) }
        }
    }
}

// MARK: - Session delegate

/// Lives off the main actor because the sessions call back on their own queue,
/// and because the finished-file callback has to move the temp file *before* it
/// returns. Everything else hops to `DownloadsStore`.
///
/// Serves both sessions, which share one serial delegate queue — that's what
/// makes `bundleLocations` safe to touch without a lock, and what guarantees
/// the HLS location arrives before the completion that consumes it.
private final class DownloadsSessionDelegate: NSObject, URLSessionDownloadDelegate,
                                              AVAssetDownloadDelegate {
    weak var store: DownloadsStore?
    private let directory: URL
    /// Where AVFoundation put each in-flight HLS bundle, keyed by episode id.
    /// Held until the task completes, because that's the callback that knows
    /// whether the bundle is a finished download or debris to delete.
    private var bundleLocations: [String: URL] = [:]

    init(directory: URL) {
        self.directory = directory
        super.init()
    }

    // MARK: HLS

    func urlSession(
        _ session: URLSession,
        assetDownloadTask: AVAssetDownloadTask,
        didLoad timeRange: CMTimeRange,
        totalTimeRangesLoaded loadedTimeRanges: [NSValue],
        timeRangeExpectedToLoad: CMTimeRange
    ) {
        guard let id = assetDownloadTask.taskDescription else { return }
        // Segments are fetched, not bytes streamed, so completion is the share
        // of the mix's running time that's on disk. Same number the ring drew
        // before — it just comes from playable duration now.
        let expected = timeRangeExpectedToLoad.duration.seconds
        guard expected.isFinite, expected > 0 else { return }
        let loaded = loadedTimeRanges.reduce(0.0) { $0 + $1.timeRangeValue.duration.seconds }
        let progress = loaded / expected
        let store = self.store
        Task { @MainActor in store?.updateProgress(episodeId: id, progress: progress) }
    }

    /// AVFoundation owns this location — the bundle stays exactly where it is,
    /// and all we keep is a reference to it. Noted at the start of the transfer
    /// as well as at the end, so a download that dies partway through still
    /// leaves us something to delete.
    func urlSession(
        _ session: URLSession,
        assetDownloadTask: AVAssetDownloadTask,
        willDownloadTo location: URL
    ) {
        guard let id = assetDownloadTask.taskDescription else { return }
        bundleLocations[id] = location
    }

    func urlSession(
        _ session: URLSession,
        assetDownloadTask: AVAssetDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        guard let id = assetDownloadTask.taskDescription else { return }
        bundleLocations[id] = location
    }

    // MARK: Progressive files

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        guard let id = downloadTask.taskDescription, totalBytesExpectedToWrite > 0 else { return }
        let progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        let store = self.store
        Task { @MainActor in store?.updateProgress(episodeId: id, progress: progress) }
    }

    /// The temp file is deleted the moment this returns, so the move happens
    /// here on the delegate queue rather than hopping to the main actor first.
    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        guard let id = downloadTask.taskDescription else { return }
        let store = self.store

        if let response = downloadTask.response as? HTTPURLResponse,
           !(200...299).contains(response.statusCode) {
            Task { @MainActor in store?.failDownload(episodeId: id) }
            return
        }

        let destination = DownloadPaths.audio(id, in: directory)
        do {
            try? FileManager.default.removeItem(at: destination)
            try FileManager.default.moveItem(at: location, to: destination)
            let attributes = try? FileManager.default.attributesOfItem(atPath: destination.path)
            let bytes = (attributes?[.size] as? NSNumber)?.int64Value ?? 0
            Task { @MainActor in store?.finishDownload(episodeId: id, bytes: bytes) }
        } catch {
            Task { @MainActor in store?.failDownload(episodeId: id) }
        }
    }

    // MARK: Both

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let id = task.taskDescription else { return }
        let bundle = bundleLocations.removeValue(forKey: id)
        let store = self.store

        if let error {
            // A cancelled asset download still leaves its partial bundle
            // behind, and nobody else is going to clear it.
            if let bundle { try? FileManager.default.removeItem(at: bundle) }
            // A cancel is a removal we already handled.
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            Task { @MainActor in store?.failDownload(episodeId: id) }
            return
        }

        // A progressive transfer was already filed away when its temp file
        // arrived; only HLS finishes here, because only here do we know the
        // bundle survived to the end.
        guard let bundle else { return }
        let bytes = Self.sizeOnDisk(of: bundle)
        let relativePath = bundle.relativePath
        Task { @MainActor in
            store?.finishDownload(episodeId: id, bytes: bytes, bundlePath: relativePath)
        }
    }

    /// A `.movpkg` is a directory of segments, so its cost is the sum of what's
    /// inside it rather than one file's size.
    private static func sizeOnDisk(of url: URL) -> Int64 {
        let keys: [URLResourceKey] = [.totalFileAllocatedSizeKey, .isRegularFileKey]
        guard let enumerator = FileManager.default.enumerator(
            at: url, includingPropertiesForKeys: keys
        ) else { return 0 }

        var total: Int64 = 0
        for case let fileURL as URL in enumerator {
            guard let values = try? fileURL.resourceValues(forKeys: Set(keys)),
                  values.isRegularFile == true
            else { continue }
            total += Int64(values.totalFileAllocatedSize ?? 0)
        }
        return total
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        let store = self.store
        Task { @MainActor in store?.backgroundSessionDidFinishEvents() }
    }
}
