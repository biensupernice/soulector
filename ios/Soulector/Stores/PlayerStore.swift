import AVFoundation
import Combine
import Foundation
import MediaPlayer
import SwiftUI
import UIKit
import WidgetKit

// MARK: - State

enum PlaybackState: Equatable {
    case idle
    case loading
    case playing
    case paused
    case error(String)
}

// MARK: - PlayerStore

@MainActor
final class PlayerStore: ObservableObject {
    @Published private(set) var state: PlaybackState = .idle
    @Published private(set) var currentEpisode: Episode?
    @Published private(set) var currentTime: Double = 0  // seconds
    @Published private(set) var duration: Double = 0     // seconds
    @Published private(set) var currentTracks: [EpisodeTrack] = []
    @Published private(set) var isLoadingTracks = false
    @Published private(set) var accent: AccentColor?
    @Published var isSeeking = false

    /// A crossing into another set, arranged to happen when the record playing
    /// now runs out. Nil when nothing is on deck.
    @Published private(set) var queued: QueuedTransition?
    /// True from the moment a crossing starts working (which for a fade or a
    /// blend is seconds before the record actually ends) until it lands.
    @Published private(set) var isCrossing = false

    /// Emits each crossing as it completes, so a dive can follow the audio
    /// into the set it just handed over to.
    let transitionsFired = PassthroughSubject<QueuedTransition, Never>()

    /// Whether the radio is currently on air. Owned by `RadioStore`, mirrored
    /// here only so the now-playing snapshot the widget reads can show the
    /// "On Air" state on its Tune In button.
    private(set) var isRadioOn = false

    /// The fetched accent resolved to this app's chosen swatch (Vibrant).
    var effectiveAccent: AccentColor? { accent?.appSwatch }
    /// Album accent for light surfaces; falls back to the web's static
    /// default accent, hsl(0 0% 9%).
    var accentOnLight: Color { effectiveAccent?.onLight ?? Color(white: 0.09) }
    /// Album accent for elements on the black background; falls back to the
    /// white the UI uses when nothing is playing.
    var accentOnDark: Color { effectiveAccent?.onDark ?? .white }

    /// Called when an episode plays to completion. Set by the view layer to implement auto-advance.
    var onEpisodeEnded: ((Episode) -> Void)?

    /// Emits the target time (seconds) of every user-initiated seek — slider,
    /// skip buttons, lock-screen scrubbing. Programmatic seeks (the initial
    /// cue on load, radio drift corrections) don't emit, so subscribers can
    /// treat every event as the user taking control of playback.
    let userSeeks = PassthroughSubject<Double, Never>()

    var isPlaying: Bool { state == .playing }
    var isLoading: Bool { state == .loading }
    var hasEpisode: Bool { currentEpisode != nil }

    var progress: Double {
        guard duration > 0 else { return 0 }
        return currentTime / duration
    }

    // MARK: Private

    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?
    private var timeObserver: Any?
    private var cancellables = Set<AnyCancellable>()
    private var artworkLoadTask: Task<Void, Never>?
    private var tracksLoadTask: Task<Void, Never>?
    private var accentColorTask: Task<Void, Never>?
    private var loadedArtwork: MPMediaItemArtwork?
    private var loadedArtworkEpisodeId: String?
    private var pendingSeek: Double?

    /// The incoming set, buffered and cued while the current one plays out, so
    /// a crossing is a volume change rather than a load.
    private var deck: AVPlayer?
    private var deckReady = false
    private var deckTask: Task<Void, Never>?
    private var deckCancellables = Set<AnyCancellable>()
    private var crossingTask: Task<Void, Never>?

    // MARK: Init

    init() {
        configureAudioSession()
        configureRemoteCommands()
    }

    // MARK: Audio Session

    private func configureAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("[PlayerStore] Audio session error: \(error)")
        }
    }

    // MARK: Remote Commands (lock screen / AirPods)

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.addTarget { [weak self] _ in
            Task { await self?.resume() }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            Task { await self?.pause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { await self?.togglePlayPause() }
            return .success
        }

        center.skipForwardCommand.preferredIntervals = [15]
        center.skipForwardCommand.addTarget { [weak self] event in
            guard let e = event as? MPSkipIntervalCommandEvent else { return .commandFailed }
            Task { await self?.seek(to: (self?.currentTime ?? 0) + e.interval) }
            return .success
        }

        center.skipBackwardCommand.preferredIntervals = [15]
        center.skipBackwardCommand.addTarget { [weak self] event in
            guard let e = event as? MPSkipIntervalCommandEvent else { return .commandFailed }
            Task { await self?.seek(to: max(0, (self?.currentTime ?? 0) - e.interval)) }
            return .success
        }

        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            Task { await self?.seek(to: e.positionTime) }
            return .success
        }

        center.nextTrackCommand.addTarget { [weak self] _ in
            guard let self, let episode = self.currentEpisode else { return .noSuchContent }
            self.onEpisodeEnded?(episode)
            return .success
        }
    }

    // MARK: Playback control

    /// Main entry point: sets loading state, fetches the stream URL, and starts playback.
    /// `startingAt` seeds an initial seek applied once the audio is ready to play; while
    /// loading we reflect it in `currentTime` so the UI points at the target track immediately.
    func play(episode: Episode, startingAt seconds: Double? = nil) async {
        // Choosing something by hand clears whatever was on deck — the
        // arrangement was made against a record that's no longer playing.
        cancelQueued()
        tearDown()

        currentEpisode = episode
        currentTime = seconds ?? 0
        pendingSeek = seconds
        duration = 0
        currentTracks = []
        state = .loading
        updateNowPlayingInfo()
        publishNowPlaying()

        // Load tracks and accent color concurrently with stream URL
        tracksLoadTask = Task { await loadTracks(for: episode.id) }
        accentColorTask = Task { await loadAccentColor(for: episode.id) }

        // A downloaded episode plays off the disk: instant, and no network at all.
        if let localAudio = DownloadsStore.shared.audioURL(for: episode.id) {
            startPlayback(url: localAudio)
            return
        }

        do {
            guard let urls = try await APIClient.shared.fetchStreamUrl(episodeId: episode.id),
                  !urls.httpMp3128Url.isEmpty,
                  let url = URL(string: urls.httpMp3128Url) else {
                state = .error("No stream URL available")
                return
            }
            startPlayback(url: url)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    private func loadAccentColor(for episodeId: String) async {
        // Downloads carry their accent, so the sheet is colored offline too.
        if let cached = DownloadsStore.shared.cachedMetadata(for: episodeId)?.accent {
            accent = cached
        }
        guard let accent = try? await APIClient.shared.fetchAccentColor(episodeId: episodeId) else { return }
        guard !Task.isCancelled else { return }
        self.accent = accent
        // Refresh the widget so its card picks up the album tint.
        publishNowPlaying()
    }

    private func loadTracks(for episodeId: String) async {
        // Same for the tracklist: on screen immediately for a downloaded
        // episode, and the fetch below still refreshes it when there's a network.
        if let cached = DownloadsStore.shared.cachedMetadata(for: episodeId)?.tracks, !cached.isEmpty {
            currentTracks = cached
        }
        isLoadingTracks = currentTracks.isEmpty
        do {
            currentTracks = try await APIClient.shared.fetchTracks(episodeId: episodeId)
        } catch is CancellationError {
            return
        } catch {
            print("[PlayerStore] Failed to load tracks: \(error)")
        }
        isLoadingTracks = false
    }

    private func startPlayback(url: URL) {
        let item = AVPlayerItem(url: url)
        playerItem = item
        let newPlayer = AVPlayer(playerItem: item)
        player = newPlayer
        attach(item: item, to: newPlayer, autoStart: true)
    }

    /// Wires the observers a playing item needs. Split out of `startPlayback`
    /// because a crossing promotes an already-rolling deck into place, and that
    /// player needs the same wiring without being told to start.
    private func attach(item: AVPlayerItem, to attachedPlayer: AVPlayer, autoStart: Bool) {
        // Observe ready-to-play
        item.publisher(for: \.status)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                guard let self else { return }
                switch status {
                case .readyToPlay:
                    self.updateDuration()
                    guard autoStart else { return }
                    if let seek = self.pendingSeek {
                        self.pendingSeek = nil
                        self.seek(to: seek, userInitiated: false)
                    }
                    self.player?.play()
                    self.state = .playing
                    self.updateNowPlayingInfo()
                    self.publishNowPlaying()
                case .failed:
                    self.state = .error(item.error?.localizedDescription ?? "Playback failed")
                default:
                    break
                }
            }
            .store(in: &cancellables)

        // Observe duration updates
        item.publisher(for: \.duration)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.updateDuration() }
            .store(in: &cancellables)

        // Periodic time observer
        let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
        timeObserver = attachedPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self, !self.isSeeking else { return }
            self.currentTime = time.seconds.isNaN ? 0 : time.seconds
            // A crossing is arranged against this clock, so every tick is also
            // the check for whether it's time to start working.
            self.advanceQueuedTransition()
            // No widget refresh here: WidgetKit's reload budget can't absorb a
            // ticking clock, and it doesn't need to — the snapshot carries
            // elapsed + duration so the widget's timeline advances the progress
            // line itself between the discrete reloads below.
        }

        // End of playback
        NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime, object: item)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                // A crossing arranged on the last record owns what happens
                // next; auto-advance would race it to a different episode.
                guard self.queued == nil, !self.isCrossing else { return }
                let finished = self.currentEpisode
                self.state = .paused
                self.currentTime = 0
                self.player?.seek(to: .zero)
                self.publishNowPlaying()
                if let finished { self.onEpisodeEnded?(finished) }
            }
            .store(in: &cancellables)
    }

    func play() {
        player?.play()
        state = .playing
        updateNowPlayingInfo()
        publishNowPlaying()
    }

    func pause() {
        player?.pause()
        state = .paused
        updateNowPlayingInfo()
        publishNowPlaying()
    }

    func resume() {
        player?.play()
        state = .playing
        updateNowPlayingInfo()
        publishNowPlaying()
    }

    func togglePlayPause() {
        isPlaying ? pause() : resume()
    }

    func seek(to time: Double, userInitiated: Bool = true) {
        if userInitiated {
            userSeeks.send(time)
        }
        isSeeking = true
        let cmTime = CMTime(seconds: time, preferredTimescale: 600)
        currentTime = max(0, min(time, duration))
        player?.seek(to: cmTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            Task { @MainActor [weak self] in self?.isSeeking = false }
        }
        updateNowPlayingInfo()
        // A seek moves the position discontinuously, so the widget's
        // interpolated progress needs resetting to the new anchor.
        publishNowPlaying()
    }

    func forward(_ seconds: Double = 15) {
        seek(to: currentTime + seconds)
    }

    func rewind(_ seconds: Double = 15) {
        seek(to: currentTime - seconds)
    }

    func stop() {
        cancelQueued()
        tearDown()
        currentEpisode = nil
        state = .idle
        currentTime = 0
        duration = 0
        currentTracks = []
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        publishNowPlaying()
    }

    // MARK: Queued crossings

    /// How long until the arranged crossing, for the countdown.
    var queuedRemaining: Double? {
        guard let queued else { return nil }
        return max(0, queued.fireAt - currentTime)
    }

    /// Arranges a crossing and starts buffering the set it goes to. Replaces
    /// anything already on deck — only one thing can be next.
    func queue(_ transition: QueuedTransition) {
        cancelQueued()
        queued = transition
        deckTask = Task { [weak self] in await self?.prepareDeck(for: transition) }
    }

    func cancelQueued() {
        queued = nil
        isCrossing = false
        crossingTask?.cancel()
        crossingTask = nil
        deckTask?.cancel()
        deckTask = nil
        deckCancellables.removeAll()
        deck?.pause()
        deck = nil
        deckReady = false
        // A cancelled fade would otherwise leave the set half ducked.
        player?.volume = 1
    }

    /// Loads and cues the incoming set behind the one playing, so the crossing
    /// itself is a volume change rather than a network round trip.
    private func prepareDeck(for transition: QueuedTransition) async {
        let url: URL?
        if let local = DownloadsStore.shared.audioURL(for: transition.episode.id) {
            url = local
        } else if let urls = try? await APIClient.shared.fetchStreamUrl(episodeId: transition.episode.id),
                  !urls.httpMp3128Url.isEmpty {
            url = URL(string: urls.httpMp3128Url)
        } else {
            url = nil
        }

        guard let url, !Task.isCancelled, queued?.id == transition.id else { return }

        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.volume = 0
        deck = player

        // The cue point is the landing, pulled back by whatever head start the
        // style wants: a blend needs the incoming set already inside the
        // record's outro when the two meet.
        let cue = max(0, transition.startAt - transition.audio.deckLead)
        item.publisher(for: \.status)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                guard status == .readyToPlay, let self, self.deck === player else { return }
                player.seek(
                    to: CMTime(seconds: cue, preferredTimescale: 600),
                    toleranceBefore: .zero,
                    toleranceAfter: .zero
                ) { [weak self] finished in
                    guard finished else { return }
                    Task { @MainActor [weak self] in
                        guard let self, self.deck === player else { return }
                        self.deckReady = true
                    }
                }
            }
            .store(in: &deckCancellables)
    }

    /// Called on every clock tick: starts the crossing once we're inside its
    /// lead-in. The work itself runs as a task so the ramps can take their time.
    private func advanceQueuedTransition() {
        guard let transition = queued, !isCrossing else { return }
        guard currentTime >= transition.fireAt - transition.audio.lead else { return }
        isCrossing = true
        crossingTask = Task { [weak self] in await self?.performCrossing(transition) }
    }

    private func performCrossing(_ transition: QueuedTransition) async {
        // However much of the record is actually left — a scrub can leave less
        // than the style asked for, and the ramps should still finish on time.
        let remaining = max(0, transition.fireAt - currentTime)

        if transition.audio.overlaps {
            // The incoming set comes up under the outgoing one and they trade
            // places across what's left of the record.
            if let deck, deckReady {
                deck.volume = 0
                deck.play()
                let span = max(0.5, remaining)
                async let outgoing: Void = ramp(player, to: 0, duration: span)
                async let incoming: Void = ramp(deck, to: 1, duration: span)
                _ = await (outgoing, incoming)
            }
        } else {
            await ramp(player, to: 0, duration: max(0.3, remaining))
        }

        guard !Task.isCancelled else { return }
        land(transition)
    }

    /// The moment itself.
    private func land(_ transition: QueuedTransition) {
        guard let incoming = deck, deckReady else {
            // Nothing buffered in time — take the straight route and accept the
            // load. Better a late crossing than a dropped one.
            queued = nil
            isCrossing = false
            Task { await play(episode: transition.episode, startingAt: transition.startAt) }
            transitionsFired.send(transition)
            return
        }

        if !transition.audio.overlaps {
            // A style that doesn't overlap cues the deck at the landing point
            // and leaves it there until now.
            incoming.volume = transition.audio.fadeIn > 0 ? 0 : 1
            incoming.play()
        }

        promote(incoming, for: transition)

        if transition.audio.fadeIn > 0 {
            crossingTask = Task { [weak self] in
                guard let self else { return }
                await self.ramp(self.player, to: 1, duration: transition.audio.fadeIn)
            }
        }
    }

    /// Swaps the deck in as the player without stopping the sound, and moves
    /// every piece of episode state over with it.
    private func promote(_ incoming: AVPlayer, for transition: QueuedTransition) {
        guard let item = incoming.currentItem else { return }

        // Retire the outgoing player. Its observers go with it — `attach` will
        // rebuild them around the incoming item.
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
        }
        player?.pause()
        cancellables.removeAll()
        deckCancellables.removeAll()

        player = incoming
        playerItem = item
        deck = nil
        deckReady = false

        currentEpisode = transition.episode
        currentTracks = []
        duration = 0
        state = .playing
        attach(item: item, to: incoming, autoStart: false)
        updateDuration()
        let position = incoming.currentTime().seconds
        currentTime = position.isNaN ? transition.startAt : position

        tracksLoadTask?.cancel()
        tracksLoadTask = Task { [weak self] in await self?.loadTracks(for: transition.episode.id) }
        accentColorTask?.cancel()
        accent = nil
        accentColorTask = Task { [weak self] in await self?.loadAccentColor(for: transition.episode.id) }

        // Force the lock screen and widget to pick up the new artwork.
        loadedArtwork = nil
        loadedArtworkEpisodeId = nil
        updateNowPlayingInfo()
        publishNowPlaying()

        queued = nil
        isCrossing = false
        transitionsFired.send(transition)
    }

    /// Walks a player's volume to `target`. Stepping it by hand rather than
    /// through an audio mix keeps this to one place and stays cancellable.
    private func ramp(_ player: AVPlayer?, to target: Float, duration: Double) async {
        guard let player else { return }
        guard duration > 0 else {
            player.volume = target
            return
        }
        let start = player.volume
        let steps = max(1, Int(duration * 30))
        let step = UInt64(duration / Double(steps) * 1_000_000_000)
        for index in 1...steps {
            try? await Task.sleep(nanoseconds: step)
            if Task.isCancelled { return }
            player.volume = start + (target - start) * (Float(index) / Float(steps))
        }
        player.volume = target
    }

    // MARK: Private helpers

    private func updateDuration() {
        guard let item = playerItem else { return }
        let d = item.duration
        if d.isValid && !d.isIndefinite {
            duration = d.seconds
        }
    }

    private func tearDown() {
        if let obs = timeObserver {
            player?.removeTimeObserver(obs)
            timeObserver = nil
        }
        player?.pause()
        player = nil
        playerItem = nil
        cancellables.removeAll()
        artworkLoadTask?.cancel()
        artworkLoadTask = nil
        tracksLoadTask?.cancel()
        tracksLoadTask = nil
        accentColorTask?.cancel()
        accentColorTask = nil
        accent = nil
        loadedArtwork = nil
        loadedArtworkEpisodeId = nil
        pendingSeek = nil
    }

    // MARK: Radio flag (mirrored from RadioStore for the widget snapshot)

    func setRadioOn(_ on: Bool) {
        guard isRadioOn != on else { return }
        isRadioOn = on
        publishNowPlaying()
    }

    // MARK: Widget snapshot

    /// Writes the current playback state to the shared App Group container and
    /// asks WidgetKit to refresh, so the home-screen widget stays in sync.
    private func publishNowPlaying() {
        let snapshot = NowPlayingSnapshot(
            hasEpisode: currentEpisode != nil,
            title: currentEpisode?.name ?? "",
            subtitle: currentEpisode?.collectiveName ?? "",
            isPlaying: isPlaying,
            isRadioOn: isRadioOn,
            elapsedSeconds: currentTime,
            durationSeconds: duration,
            accentRGB: accent?.rgb,
            accentHSL: accent?.hsl,
            // Mirrors the key EpisodesViewModel persists, so the widget's
            // live-radio fallback tunes to the station the user last chose.
            collective: UserDefaults.standard.string(forKey: "soulector.selectedCollective"),
            updatedAt: Date()
        )
        NowPlayingStore.save(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: Now Playing Info

    private func updateNowPlayingInfo() {
        guard let episode = currentEpisode else { return }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: episode.name,
            MPMediaItemPropertyArtist: episode.collectiveName,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
        ]
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        if let artwork = loadedArtwork {
            info[MPMediaItemPropertyArtwork] = artwork
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        // Load artwork once per episode
        if loadedArtworkEpisodeId != episode.id {
            loadedArtworkEpisodeId = episode.id
            loadedArtwork = nil
            artworkLoadTask?.cancel()
            artworkLoadTask = Task {
                var image: UIImage?
                // The downloaded copy keeps the lock screen right offline.
                if let local = DownloadsStore.shared.artworkURL(for: episode.id) {
                    image = UIImage(contentsOfFile: local.path)
                }
                if image == nil, let url = URL(string: episode.artworkUrl),
                   let (data, _) = try? await URLSession.shared.data(from: url) {
                    image = UIImage(data: data)
                }
                guard let image else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                self.loadedArtwork = artwork
                // Update now playing info with artwork
                var updated = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                updated[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = updated
                // Cache a downsampled copy for the widget and refresh it.
                NowPlayingStore.saveArtwork(image: image)
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }
}
