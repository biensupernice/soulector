import Combine
import Foundation
import UIKit

/// Orchestrates radio mode — the iOS counterpart of the web's `useRadio` hook
/// (`src/client/EpisodesScreen/useRadio.tsx`), with the same semantics:
///
/// - Tuning in plays whatever the deterministic schedule says is on the air,
///   at the live offset. No episode sheet opens; the mini player picking up
///   the broadcast is the feedback.
/// - A slot-boundary timer advances to the next episode when the current
///   slot's scheduled end passes.
/// - Pause suspends the radio; resuming re-syncs to the live position instead
///   of continuing where playback stopped.
/// - Drift correction keeps playback pinned to the live position (stream
///   loading lags every device behind live by a different amount).
/// - Seeking away from the live position, or playing an episode the schedule
///   didn't ask for, is the user taking over: the radio tunes out. Tuning out
///   leaves the current episode playing — only the "follow the broadcast"
///   behavior stops.
@MainActor
final class RadioStore: ObservableObject {
    @Published private(set) var isOn = false
    /// The schedule slot the radio is currently tuned to, while on.
    @Published private(set) var slot: RadioSlot?

    /// Playback naturally lags the schedule a little (stream load time, timer
    /// jitter), so only treat deviations beyond this as the user seeking away
    /// from the broadcast.
    private static let liveDriftToleranceMs = 10_000

    /// Drift correction: the tune-in seek targets the live offset computed at
    /// tune-in time, but stream loading and buffering delay actual playback
    /// by a device-dependent few seconds, leaving every device behind live by
    /// a different amount. While on air, playback that has drifted beyond the
    /// threshold is snapped back to the live position. Each seek costs a
    /// re-buffer, so a correction doubles the threshold for the next one
    /// (reset per slot): fast connections converge in one hop, slow ones
    /// settle at an honest lag instead of seeking in a loop.
    private static let driftCorrectionMinMs = 4_000
    private static let driftMaxThresholdMs = 60_000
    private static let driftCheckInterval: TimeInterval = 5
    /// Don't bother re-syncing into the last moments of a slot.
    private static let slotEndGuardMs = 8_000

    /// Set when the audio finished before the scheduled slot boundary (stored
    /// durations can slightly overshoot the real audio). The boundary timer
    /// treats this as "still listening" rather than a user pause, so the
    /// broadcast advances at the boundary instead of stalling.
    private var waitingForBoundary = false

    // Wired once from the view layer via `configure`; inert until then.
    private var player: PlayerStore?
    private var episodesVM: EpisodesViewModel?

    private var cancellables = Set<AnyCancellable>()
    private var boundaryTimer: Timer?
    private var driftTimer: Timer?
    private var driftThresholdMs = RadioStore.driftCorrectionMinMs
    private var lastPlayerState: PlaybackState = .idle

    private static func nowMs() -> Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }

    // MARK: Wiring

    func configure(player: PlayerStore, episodesVM: EpisodesViewModel) {
        guard self.player == nil else { return }
        self.player = player
        self.episodesVM = episodesVM

        // Radio semantics for resume: catch back up with the live broadcast
        // instead of continuing from where playback was paused.
        // (@Published emits during willSet, so track transitions from the
        // emitted values rather than reading properties inside the sink.)
        player.$state
            .sink { [weak self] newState in
                guard let self else { return }
                let wasPaused = self.lastPlayerState == .paused
                self.lastPlayerState = newState
                if wasPaused && newState == .playing {
                    self.resyncAfterResume()
                } else if case .error = newState, self.isOn {
                    // The stream failed to load or play; tune out rather than
                    // sit "on air" in silence.
                    self.tuneOut()
                }
            }
            .store(in: &cancellables)

        // Seeking away from the live position (slider, skip buttons, lock
        // screen) is the user taking over: drop out of radio mode. Radio's
        // own seeks aren't user-initiated and land at the live offset anyway.
        player.userSeeks
            .sink { [weak self] targetSeconds in
                self?.handleUserSeek(to: targetSeconds)
            }
            .store(in: &cancellables)

        // An episode change the schedule didn't ask for — a manual play from
        // any screen, or the player being stopped — tunes the radio out.
        // Radio's own loads never trip this: `tuneToNow` publishes the slot
        // before touching the player, so by the time `currentEpisode` changes
        // it already matches `slot.episodeId`.
        player.$currentEpisode
            .sink { [weak self] episode in
                guard let self, self.isOn, let slot = self.slot else { return }
                if episode?.id != slot.episodeId {
                    self.tuneOut()
                }
            }
            .store(in: &cancellables)

        // Changing the collective while tuned in switches stations.
        episodesVM.$selectedCollective
            .dropFirst()
            .removeDuplicates()
            .sink { [weak self] collective in
                guard let self, self.isOn else { return }
                if !self.tuneToNow(collective: collective) {
                    self.tuneOut()
                }
            }
            .store(in: &cancellables)

        // Timers can be suspended in the background (when nothing is
        // playing); catch up on a missed boundary when the app returns.
        NotificationCenter.default
            .publisher(for: UIApplication.willEnterForegroundNotification)
            .sink { [weak self] _ in
                guard let self, self.isOn, let slot = self.slot else { return }
                if Self.nowMs() >= slot.endsAtMs {
                    self.advance()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: Tuning

    func tuneIn() {
        tuneToNow()
    }

    /// Leaves the current episode playing; only the "follow the broadcast"
    /// behavior stops.
    func tuneOut() {
        boundaryTimer?.invalidate()
        boundaryTimer = nil
        driftTimer?.invalidate()
        driftTimer = nil
        waitingForBoundary = false
        slot = nil
        isOn = false
    }

    /// The audio ran out. Stored durations can slightly overshoot the real
    /// audio, so this usually lands just before the scheduled boundary: stay
    /// on air and let the boundary timer advance — unless the boundary has
    /// already passed, in which case advance immediately.
    func handlePlaybackEnded() {
        guard isOn, let slot else { return }
        if Self.nowMs() >= slot.endsAtMs {
            if !tuneToNow() {
                tuneOut()
            }
        } else {
            waitingForBoundary = true
        }
    }

    @discardableResult
    private func tuneToNow(collective: CollectiveFilter? = nil) -> Bool {
        guard let player, let episodesVM else { return false }
        let selected = collective ?? episodesVM.selectedCollective

        let pool = Self.radioPool(episodesVM.episodes, collective: selected)
        guard
            let next = RadioSchedule.slotAt(
                episodes: pool,
                stationKey: RadioSchedule.stationKey(collective: selected.rawValue),
                nowMs: Self.nowMs()
            ),
            let episode = pool.first(where: { $0.id == next.episodeId })
        else { return false }

        // Update radio state before touching the player: the player
        // subscriptions judge player changes against the slot being tuned to,
        // not the previous one.
        slot = next
        isOn = true
        waitingForBoundary = false
        driftThresholdMs = Self.driftCorrectionMinMs
        scheduleBoundaryTimer(for: next)
        startDriftTimerIfNeeded()

        let offsetSeconds = Double(next.offsetMs) / 1000
        Task { await player.play(episode: episode, startingAt: offsetSeconds) }
        return true
    }

    private static func radioPool(_ episodes: [Episode], collective: CollectiveFilter) -> [Episode] {
        let scoped = collective == .all
            ? episodes
            : episodes.filter { $0.collectiveSlug == collective.rawValue }
        return scoped.filter(\.isStreamable)
    }

    // MARK: Slot boundary

    private func scheduleBoundaryTimer(for slot: RadioSlot) {
        boundaryTimer?.invalidate()
        // Land just inside the next slot so the schedule resolves to it.
        let delay = max(0, Double(slot.endsAtMs - Self.nowMs()) / 1000) + 0.5
        boundaryTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.advance()
            }
        }
    }

    /// Advance to the next slot once this one's scheduled end passes. A user
    /// pause suspends the radio (resume re-syncs instead); audio that ran out
    /// before the boundary (`waitingForBoundary`) still advances.
    private func advance() {
        guard isOn, let player else { return }
        let listening = player.isPlaying || player.isLoading
        if !listening && !waitingForBoundary { return }
        if !tuneToNow() {
            // No next slot to tune to (episodes unavailable, pool emptied):
            // tune out rather than wedge in a permanently stalled on-air state.
            tuneOut()
        }
    }

    // MARK: Drift correction

    private func startDriftTimerIfNeeded() {
        guard driftTimer == nil else { return }
        driftTimer = Timer.scheduledTimer(withTimeInterval: Self.driftCheckInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.correctDriftIfNeeded()
            }
        }
    }

    private func correctDriftIfNeeded() {
        guard isOn, let slot, let player else { return }

        // Backstop for a lost boundary timer (e.g. suspended mid-flight).
        if Self.nowMs() >= slot.endsAtMs {
            advance()
            return
        }

        guard
            player.isPlaying,
            !player.isSeeking,
            player.currentEpisode?.id == slot.episodeId
        else { return }

        let liveOffsetMs = Self.nowMs() - slot.startsAtMs
        if liveOffsetMs >= (slot.endsAtMs - slot.startsAtMs) - Self.slotEndGuardMs {
            return
        }

        let driftMs = Double(liveOffsetMs) - player.currentTime * 1000
        if abs(driftMs) > Double(driftThresholdMs) {
            driftThresholdMs = min(driftThresholdMs * 2, Self.driftMaxThresholdMs)
            player.seek(to: Double(liveOffsetMs) / 1000, userInitiated: false)
        }
    }

    // MARK: Reactions

    private func resyncAfterResume() {
        guard isOn, let player, let episodesVM, slot != nil else { return }
        // During the ended-early gap the live offset is past the real audio
        // end; seeking there would just re-fire "ended". The boundary timer
        // advances instead.
        guard !waitingForBoundary else { return }

        let selected = episodesVM.selectedCollective
        let pool = Self.radioPool(episodesVM.episodes, collective: selected)
        guard
            let now = RadioSchedule.slotAt(
                episodes: pool,
                stationKey: RadioSchedule.stationKey(collective: selected.rawValue),
                nowMs: Self.nowMs()
            )
        else { return }

        if now.episodeId != player.currentEpisode?.id {
            // Paused across a slot boundary; the broadcast moved on.
            if !tuneToNow() {
                tuneOut()
            }
        } else if abs(player.currentTime * 1000 - Double(now.offsetMs)) > Double(Self.liveDriftToleranceMs) {
            player.seek(to: Double(now.offsetMs) / 1000, userInitiated: false)
        }
    }

    private func handleUserSeek(to targetSeconds: Double) {
        guard isOn, let slot, let player,
              player.currentEpisode?.id == slot.episodeId else { return }
        let liveOffsetMs = Double(Self.nowMs() - slot.startsAtMs)
        if abs(targetSeconds * 1000 - liveOffsetMs) > Double(Self.liveDriftToleranceMs) {
            tuneOut()
        }
    }
}
