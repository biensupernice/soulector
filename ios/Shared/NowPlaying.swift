import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Constants shared between the app and the widget extension.
enum SoulectorShared {
    /// App Group container both targets read/write. Must be enabled as an
    /// App Group capability on both targets' signing (see the `.entitlements`
    /// files); the container is where the now-playing snapshot + artwork live.
    static let appGroupID = "group.com.soulector.app"
}

/// A snapshot of what the app is playing, written to the shared App Group
/// container on every meaningful playback change and read by the home-screen
/// widget. Deliberately small and self-contained: the widget can't reach the
/// app's `PlayerStore`, so everything it renders travels through here.
struct NowPlayingSnapshot: Codable, Equatable {
    var hasEpisode: Bool
    var title: String
    var subtitle: String
    var isPlaying: Bool
    var isRadioOn: Bool
    /// Playback position and length, rather than a baked 0...1 fraction, so the
    /// widget's timeline can advance the progress line on its own between
    /// reloads instead of spending reload budget on it.
    var elapsedSeconds: Double
    var durationSeconds: Double
    /// The raw extracted album swatch — the server's dark-leaning default,
    /// built to host white text — used as the widget card's tint (the "accent
    /// from the upper mark"). Optional until an accent has been fetched.
    var accentRGB: [Double]?
    var accentHSL: [Double]?
    /// The station the user last listened to, so the widget's live-radio
    /// fallback tunes to the same collective the app would. Optional for
    /// snapshots written before the field existed.
    var collective: String?
    var updatedAt: Date

    /// 0...1 position for the progress line.
    var progress: Double {
        guard durationSeconds > 0 else { return 0 }
        return min(1, max(0, elapsedSeconds / durationSeconds))
    }

    /// The same snapshot rolled forward, for timeline entries that sit in the
    /// future: playback keeps running between reloads, so the progress line
    /// should keep moving.
    func advanced(by seconds: Double) -> NowPlayingSnapshot {
        var copy = self
        copy.elapsedSeconds = min(durationSeconds, elapsedSeconds + seconds)
        return copy
    }

    static let empty = NowPlayingSnapshot(
        hasEpisode: false,
        title: "",
        subtitle: "",
        isPlaying: false,
        isRadioOn: false,
        elapsedSeconds: 0,
        durationSeconds: 0,
        accentRGB: nil,
        accentHSL: nil,
        collective: nil,
        updatedAt: .distantPast
    )

    /// Sample used for widget previews and the placeholder state.
    static let preview = NowPlayingSnapshot(
        hasEpisode: true,
        title: "Soulection Radio Show #521",
        subtitle: "Soulection",
        isPlaying: true,
        isRadioOn: false,
        elapsedSeconds: 25 * 60,
        durationSeconds: 60 * 60,
        accentRGB: [120, 72, 60],
        accentHSL: [0.03, 0.33, 0.35],
        collective: "soulection",
        updatedAt: Date()
    )
}

/// The station the widget's live-radio fallback tunes to when the app hasn't
/// told it otherwise — the same collective `EpisodesViewModel` defaults to.
let soulectorDefaultCollective = "soulection"

/// Reads and writes the now-playing snapshot + a downsampled artwork image in
/// the shared App Group container.
enum NowPlayingStore {
    private static let snapshotFile = "now_playing.json"
    private static let artworkFile = "now_playing_artwork.jpg"

    static var containerURL: URL? {
        FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SoulectorShared.appGroupID
        )
    }

    // MARK: Snapshot

    static func save(_ snapshot: NowPlayingSnapshot) {
        guard let url = containerURL?.appendingPathComponent(snapshotFile),
              let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func load() -> NowPlayingSnapshot {
        guard let url = containerURL?.appendingPathComponent(snapshotFile),
              let data = try? Data(contentsOf: url),
              let snapshot = try? JSONDecoder().decode(NowPlayingSnapshot.self, from: data)
        else { return .empty }
        return snapshot
    }

    // MARK: Artwork

    static var artworkURL: URL? {
        containerURL?.appendingPathComponent(artworkFile)
    }

    static func saveArtwork(_ data: Data) {
        guard let url = artworkURL else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func loadArtworkData() -> Data? {
        guard let url = artworkURL else { return nil }
        return try? Data(contentsOf: url)
    }

#if canImport(UIKit)
    /// Downsamples artwork to a widget-friendly size before it goes in the
    /// shared container — the full-resolution album art is far larger than the
    /// widget renders.
    static func saveArtwork(image: UIImage, maxDimension: CGFloat = 240) {
        let size = image.size
        guard size.width > 0, size.height > 0 else { return }
        let scale = min(1, maxDimension / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: target)
        let scaled = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        if let data = scaled.jpegData(compressionQuality: 0.8) {
            saveArtwork(data)
        }
    }
#endif
}
