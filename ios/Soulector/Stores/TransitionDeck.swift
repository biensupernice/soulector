import AVFoundation
import Combine
import Foundation

/// The set waiting behind the one playing.
///
/// A transition has to be a volume change rather than a network round trip, so
/// the incoming set is loaded and parked on its cue point the instant the
/// transition is arranged — which can be minutes before it fires. That's a
/// second `AVPlayer` and its observers living a life of their own, and it only
/// exists while something is on deck.
///
/// It lives here rather than as fields on `PlayerStore` because that's exactly
/// what it is: a handful of values that are meaningless whenever nothing is
/// arranged. `PlayerStore` still owns the transition itself — when it fires,
/// what it sounds like, and swapping the players over. This owns the buffering.
@MainActor
final class TransitionDeck {
    private var player: AVPlayer?
    private var isCued = false
    private var loadTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()

    /// The incoming set, but only once it has loaded *and* reached its cue
    /// point. Nil means the transition has to take the slow route and accept a
    /// load, so callers must handle it rather than assume the buffer won.
    var readyPlayer: AVPlayer? { isCued ? player : nil }

    /// Loads the set this transition goes to and parks it on its cue point.
    /// Replaces whatever was on deck — only one thing can be next.
    func prepare(for transition: QueuedTransition) {
        cancel()
        loadTask = Task { [weak self] in await self?.load(transition) }
    }

    /// Hands the buffered player over, and keeps nothing. Whoever takes it owns
    /// it from then on, including rebuilding the observers around it.
    func take() -> AVPlayer? {
        guard let taken = readyPlayer else { return nil }
        cancellables.removeAll()
        player = nil
        isCued = false
        loadTask = nil
        return taken
    }

    func cancel() {
        loadTask?.cancel()
        loadTask = nil
        cancellables.removeAll()
        player?.pause()
        player = nil
        isCued = false
    }

    private func load(_ transition: QueuedTransition) async {
        let url: URL?
        if let local = DownloadsStore.shared.audioURL(for: transition.episode.id) {
            url = local
        } else if let urls = try? await APIClient.shared.fetchStreamUrl(episodeId: transition.episode.id),
                  !urls.streamUrl.isEmpty {
            url = URL(string: urls.streamUrl)
        } else {
            url = nil
        }

        // `prepare` cancelled the previous task, so a stale load lands here.
        guard let url, !Task.isCancelled else { return }

        // Asset-backed, the same as the front player: the deck resolves to an
        // HLS playlist or a downloaded `.movpkg` just as often, and only
        // `AVURLAsset` knows how to open either.
        let item = AVPlayerItem(asset: AVURLAsset(url: url))
        let loaded = AVPlayer(playerItem: item)
        loaded.volume = 0
        player = loaded

        // The cue point is the landing, pulled back by whatever head start the
        // style wants: a blend needs the incoming set already inside the
        // record's outro when the two meet.
        let cue = max(0, transition.startAt - transition.audio.deckLead)
        item.publisher(for: \.status)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                guard status == .readyToPlay, let self, self.player === loaded else { return }
                loaded.seek(
                    to: CMTime(seconds: cue, preferredTimescale: 600),
                    toleranceBefore: .zero,
                    toleranceAfter: .zero
                ) { finished in
                    guard finished else { return }
                    Task { @MainActor [weak self] in
                        guard let self, self.player === loaded else { return }
                        self.isCued = true
                    }
                }
            }
            .store(in: &cancellables)
    }
}
