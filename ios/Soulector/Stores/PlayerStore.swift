import AVFoundation
import Combine
import Foundation
import MediaPlayer
import SwiftUI
import UIKit

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
    @Published private(set) var accentColor: Color = .black
    @Published var isSeeking = false

    /// Called when an episode plays to completion. Set by the view layer to implement auto-advance.
    var onEpisodeEnded: ((Episode) -> Void)?

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
    func play(episode: Episode) async {
        tearDown()

        currentEpisode = episode
        currentTime = 0
        duration = 0
        currentTracks = []
        state = .loading
        updateNowPlayingInfo()

        // Load tracks and accent color concurrently with stream URL
        tracksLoadTask = Task { await loadTracks(for: episode.id) }
        accentColorTask = Task { await loadAccentColor(for: episode.id) }

        do {
            guard let urls = try await APIClient.shared.fetchStreamUrl(episodeId: episode.id),
                  !urls.httpMp3128Url.isEmpty else {
                state = .error("No stream URL available")
                return
            }
            startPlayback(streamUrl: urls.httpMp3128Url)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    private func loadAccentColor(for episodeId: String) async {
        guard let accent = try? await APIClient.shared.fetchAccentColor(episodeId: episodeId) else { return }
        guard !Task.isCancelled else { return }
        accentColor = accent.swiftUIColor
    }

    private func loadTracks(for episodeId: String) async {
        isLoadingTracks = true
        do {
            currentTracks = try await APIClient.shared.fetchTracks(episodeId: episodeId)
        } catch is CancellationError {
            return
        } catch {
            print("[PlayerStore] Failed to load tracks: \(error)")
        }
        isLoadingTracks = false
    }

    private func startPlayback(streamUrl: String) {
        guard let url = URL(string: streamUrl) else {
            state = .error("Invalid stream URL")
            return
        }

        let item = AVPlayerItem(url: url)
        playerItem = item
        player = AVPlayer(playerItem: item)

        // Observe ready-to-play
        item.publisher(for: \.status)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                guard let self else { return }
                switch status {
                case .readyToPlay:
                    self.player?.play()
                    self.state = .playing
                    self.updateDuration()
                    self.updateNowPlayingInfo()
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
        timeObserver = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self, !self.isSeeking else { return }
            self.currentTime = time.seconds.isNaN ? 0 : time.seconds
        }

        // End of playback
        NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime, object: item)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                let finished = self.currentEpisode
                self.state = .paused
                self.currentTime = 0
                self.player?.seek(to: .zero)
                if let finished { self.onEpisodeEnded?(finished) }
            }
            .store(in: &cancellables)
    }

    func play() {
        player?.play()
        state = .playing
        updateNowPlayingInfo()
    }

    func pause() {
        player?.pause()
        state = .paused
        updateNowPlayingInfo()
    }

    func resume() {
        player?.play()
        state = .playing
        updateNowPlayingInfo()
    }

    func togglePlayPause() {
        isPlaying ? pause() : resume()
    }

    func seek(to time: Double) {
        isSeeking = true
        let cmTime = CMTime(seconds: time, preferredTimescale: 600)
        currentTime = max(0, min(time, duration))
        player?.seek(to: cmTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            Task { @MainActor [weak self] in self?.isSeeking = false }
        }
        updateNowPlayingInfo()
    }

    func forward(_ seconds: Double = 15) {
        seek(to: currentTime + seconds)
    }

    func rewind(_ seconds: Double = 15) {
        seek(to: currentTime - seconds)
    }

    func stop() {
        tearDown()
        currentEpisode = nil
        state = .idle
        currentTime = 0
        duration = 0
        currentTracks = []
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
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
        accentColor = .black
        loadedArtwork = nil
        loadedArtworkEpisodeId = nil
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
                guard let url = URL(string: episode.artworkUrl) else { return }
                guard let (data, _) = try? await URLSession.shared.data(from: url),
                      let image = UIImage(data: data) else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                self.loadedArtwork = artwork
                // Update now playing info with artwork
                var updated = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                updated[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = updated
            }
        }
    }
}
