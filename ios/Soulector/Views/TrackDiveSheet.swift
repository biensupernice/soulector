import SwiftUI

// MARK: - Sideways affordance

/// The way sideways: how many other sets played this track, and the tap that
/// opens them. Sized to sit at the end of a tracklist row without competing
/// with the row's own tap.
struct TrackBranchButton: View {
    let count: Int
    var tint: Color = .white
    let action: () -> Void

    /// Every tracklist row reserves exactly this much room for the branch,
    /// whether or not it has one — otherwise the timestamps ahead of it shift
    /// column depending on the row, which reads as broken. Wide enough for the
    /// two-digit counts the library actually reaches.
    static let slotWidth: CGFloat = 44

    var body: some View {
        Button(action: {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        }) {
            HStack(spacing: 3) {
                Image(systemName: "arrow.triangle.branch")
                    .font(.system(size: 10, weight: .semibold))
                Text("\(count)")
                    .font(.app(size: 11, weight: .semibold))
            }
            .foregroundColor(tint.opacity(0.9))
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Capsule().fill(tint.opacity(0.15)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Also played in \(count) other \(count == 1 ? "episode" : "episodes")")
    }
}

/// The branch, or the space where one would be. Tracklist rows always render
/// this so every row's timestamp lands on the same column.
struct TrackBranchSlot: View {
    let count: Int
    var tint: Color = .white
    let action: () -> Void

    var body: some View {
        Group {
            if count > 0 {
                TrackBranchButton(count: count, tint: tint, action: action)
            } else {
                Color.clear.frame(height: 1)
            }
        }
        .frame(width: TrackBranchButton.slotWidth, alignment: .trailing)
    }
}

// MARK: - Dive

/// Preferences that belong to the dive rather than to any one screen of it.
/// Kept as bare keys so the chrome (which owns the menu) and the screens
/// (which act on them) can read the same settings without threading state.
enum DiveSettings {
    static let onDeckKey = "soulector.dive.onDeck"
    static let audioKey = "soulector.dive.audio"
    static let visualKey = "soulector.dive.visual"
    static let focusKey = "soulector.dive.focusLanding"
}

/// One step of a dive. A dive alternates between the two: a track shows the
/// sets that played it, a set shows the tracks you can leave by. An episode
/// step remembers which track carried you into it, so the screen can put that
/// track in front of you.
private enum DiveStep: Hashable {
    case track(TrackAppearance)
    case episode(Episode, landedOn: Int?)
}

/// The bits every screen in the dive needs but doesn't own.
private struct DiveActions {
    /// Reports the episode the dive is now playing, so the screen underneath
    /// can catch up instead of still showing where the user started.
    let onLanded: (Episode) -> Void
    /// Leaves the dive entirely. `@Environment(\.dismiss)` inside a pushed
    /// screen would only pop a step, so the sheet's own dismiss is passed down.
    let close: () -> Void
}

/// Album accents for the episodes a dive passes through, fetched once and kept
/// for the length of the dive so stepping back through the path doesn't refetch
/// (or re-flash) colours the user has already seen.
@MainActor
private final class DiveAccents: ObservableObject {
    @Published private var byEpisode: [String: AccentColor] = [:]
    private var inFlight: Set<String> = []

    init(seed: [String: AccentColor?] = [:]) {
        for (id, accent) in seed {
            if let accent { byEpisode[id] = accent }
        }
    }

    /// This episode's accent resolved to the app's swatch (Vibrant), matching
    /// the episode sheet.
    func accent(for episodeId: String) -> AccentColor? { byEpisode[episodeId]?.appSwatch }

    func load(_ episodeId: String, playing: PlayerStore) async {
        guard byEpisode[episodeId] == nil, !inFlight.contains(episodeId) else { return }
        inFlight.insert(episodeId)
        defer { inFlight.remove(episodeId) }

        // Whatever is already on hand paints the screen this frame; the fetch
        // below only refines it.
        if playing.currentEpisode?.id == episodeId, let accent = playing.accent {
            byEpisode[episodeId] = accent
        } else if let cached = DownloadsStore.shared.cachedMetadata(for: episodeId)?.accent {
            byEpisode[episodeId] = cached
        }
        if let fetched = try? await APIClient.shared.fetchAccentColor(episodeId: episodeId) {
            byEpisode[episodeId] = fetched
        }
    }
}

/// Moving *sideways*: from a track in the set you're listening to, out to the
/// other sets that played the same record, into one of them, and on again from
/// its tracklist. The navigation stack is the dive — every step is a push, so
/// back retraces the path you took through the library.
///
/// Everything here reads from `EpisodesViewModel.trackGraph`, which is built
/// from the on-device search index: no request stands between a tap and the
/// next set. Each screen is painted in the album accent of the episode in
/// view — a track screen in the accent of the set it came from — so a dive
/// feels like walking between episode sheets rather than leaving them.
struct TrackDiveSheet: View {
    /// The track the dive starts from, and the episode it was playing in.
    let origin: TrackAppearance
    /// The origin episode's accent, already fetched by the sheet presenting
    /// this one, so the first screen is painted without a flash of grey.
    var seedAccent: AccentColor?
    var onLanded: (Episode) -> Void = { _ in }

    @State private var path: [DiveStep] = []
    @StateObject private var accents: DiveAccents
    @EnvironmentObject private var playerStore: PlayerStore
    @Environment(\.dismiss) private var dismiss

    init(
        origin: TrackAppearance,
        seedAccent: AccentColor? = nil,
        onLanded: @escaping (Episode) -> Void = { _ in }
    ) {
        self.origin = origin
        self.seedAccent = seedAccent
        self.onLanded = onLanded
        _accents = StateObject(wrappedValue: DiveAccents(seed: [origin.episode.id: seedAccent]))
    }

    var body: some View {
        NavigationStack(path: $path) {
            DiveTrackScreen(appearance: origin, path: $path, actions: actions)
                .navigationDestination(for: DiveStep.self) { step in
                    switch step {
                    case .track(let appearance):
                        DiveTrackScreen(appearance: appearance, path: $path, actions: actions)
                    case .episode(let episode, let landedOn):
                        DiveEpisodeScreen(
                            episode: episode,
                            landedOn: landedOn,
                            path: $path,
                            actions: actions
                        )
                    }
                }
        }
        .environmentObject(accents)
        // The dive crosses the whole library, so its chrome stays monochrome
        // rather than picking up any one album's accent.
        .tint(.white)
        // An arranged crossing lands on its own schedule. When it does, the
        // dive follows the audio in — the whole point was to go there.
        .onReceive(playerStore.transitionsFired) { transition in
            onLanded(transition.episode)
            path.append(.episode(transition.episode, landedOn: transition.track.order))
        }
    }

    private var actions: DiveActions {
        DiveActions(onLanded: onLanded, close: { dismiss() })
    }
}

// MARK: - Track screen (the sets that played it)

private struct DiveTrackScreen: View {
    let appearance: TrackAppearance
    @Binding var path: [DiveStep]
    let actions: DiveActions

    @EnvironmentObject var episodesVM: EpisodesViewModel
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var radioStore: RadioStore
    @EnvironmentObject var accents: DiveAccents

    @AppStorage(DiveSettings.onDeckKey) private var onDeck = false
    @AppStorage(DiveSettings.audioKey) private var audioStyle = TransitionAudio.blend
    @AppStorage(DiveSettings.visualKey) private var visualStyle = TransitionVisual.ring

    private var others: [TrackAppearance] {
        episodesVM.trackGraph.otherAppearances(
            of: appearance.track,
            excluding: appearance.episode.id
        )
    }

    /// Painted in the accent of the set this track came from — the screen the
    /// user just stepped off. With a sweep crossing on deck it drifts toward
    /// the colour of the set it's about to hand over to, arriving as the
    /// record ends.
    private var accent: Color {
        guard let base = accents.accent(for: appearance.episode.id) else { return Color(white: 0.09) }
        if let crossing = playerStore.queued,
           crossing.visual == .sweep,
           let destination = accents.accent(for: crossing.episode.id) {
            return base
                .blended(toward: destination, amount: crossing.progress(at: playerStore.currentTime))
                .raw
        }
        return base.raw
    }

    var body: some View {
        let elsewhere = others

        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header(count: elsewhere.count)

                if elsewhere.isEmpty {
                    emptyState
                } else {
                    ForEach(elsewhere) { other in
                        DiveEpisodeRow(appearance: other) { open(other) }
                    }
                }

                Color.clear.frame(height: 24)
            }
        }
        .diveChrome(title: appearance.track.name, accent: accent, close: actions.close)
        .task(id: appearance.episode.id) {
            await accents.load(appearance.episode.id, playing: playerStore)
        }
    }

    private func header(count: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(appearance.track.name)
                .font(.app(size: 22, weight: .bold))
                .foregroundColor(.white)
                .fixedSize(horizontal: false, vertical: true)

            Text(appearance.track.artist)
                .font(.app(size: 15))
                .foregroundColor(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)

            if count > 0 {
                Text("ALSO PLAYED IN \(count) OTHER \(count == 1 ? "EPISODE" : "EPISODES")")
                    .font(.app(size: 11, weight: .semibold))
                    .tracking(1)
                    .foregroundColor(.white.opacity(0.5))
                    .padding(.top, 10)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 14)
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: episodesVM.isSearchIndexLoading ? "arrow.triangle.branch" : "circle.dashed")
                .font(.system(size: 28))
                .foregroundColor(.white.opacity(0.4))
                .padding(.bottom, 2)

            Text(episodesVM.isSearchIndexLoading ? "Loading library…" : "No other set played this one")
                .font(.app(size: 15, weight: .semibold))
                .foregroundColor(.white)

            Text(
                episodesVM.isSearchIndexLoading
                    ? "The tracklists are still coming down."
                    : "Nothing sideways from here yet — try another track in the set."
            )
            .font(.app(size: 13))
            .foregroundColor(.white.opacity(0.6))
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
        .padding(.top, 48)
    }

    /// Sideways: the same record, in a different set. Either right now, from
    /// the moment it drops — or arranged for when the record finishes here, so
    /// the two sets change hands over its outro.
    private func open(_ other: TrackAppearance) {
        if onDeck {
            // Tapping what's already on deck calls it off.
            if playerStore.queued?.episode.id == other.episode.id,
               playerStore.queued?.track.order == other.track.order {
                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                playerStore.cancelQueued()
                return
            }
            if let transition = plannedCrossing(to: other) {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                playerStore.queue(transition)
                // Load the destination's accent now: the sweep drifts this
                // screen's colour toward it while the record plays out.
                Task { await accents.load(other.episode.id, playing: playerStore) }
                return
            }
            // Nothing playing, no cue sheet, or the record is already ending —
            // there's no outro left to hand over on, so just go.
        }

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        // A manual play takes over from the radio, same as anywhere else.
        radioStore.tuneOut()

        if playerStore.currentEpisode?.id == other.episode.id {
            if let timestamp = other.track.timestamp {
                playerStore.seek(to: Double(timestamp))
            }
        } else {
            Task {
                await playerStore.play(
                    episode: other.episode,
                    startingAt: other.track.timestamp.map(Double.init)
                )
            }
        }

        actions.onLanded(other.episode)
        path.append(.episode(other.episode, landedOn: other.track.order))
    }

    /// Works out where the record playing now runs out, and where the same
    /// record runs out in the set being crossed into. Nil when there's nothing
    /// to hand over from — no episode, no cue sheet, or the outro is already
    /// upon us.
    private func plannedCrossing(to other: TrackAppearance) -> QueuedTransition? {
        guard playerStore.hasEpisode else { return nil }
        let playing = playerStore.currentTracks
        guard !playing.isEmpty else { return nil }

        let now = playerStore.currentTime
        guard let index = playing.lastIndex(where: { track in
            guard let timestamp = track.timestamp else { return false }
            return Double(timestamp) <= now
        }) else { return nil }

        // The end of the record playing here: the next cue, or the end of the set.
        let endsHere: Double
        if index + 1 < playing.count, let next = playing[index + 1].timestamp {
            endsHere = Double(next)
        } else if playerStore.duration > 0 {
            endsHere = playerStore.duration
        } else {
            return nil
        }
        // Too close to arrange — by the time the tap registers it's already gone.
        guard endsHere - now > 2 else { return nil }

        // The end of the same record over there, which is where we come in.
        let target = episodesVM.trackGraph.tracks(forEpisode: other.episode.id)
        let landsAt: Double
        if let match = target.firstIndex(where: { $0.order == other.track.order }),
           match + 1 < target.count, let next = target[match + 1].timestamp {
            landsAt = Double(next)
        } else if let timestamp = other.track.timestamp {
            // Last record in that set — nothing after it to land on, so take
            // the record itself.
            landsAt = Double(timestamp)
        } else {
            landsAt = 0
        }

        return QueuedTransition(
            episode: other.episode,
            track: other.track,
            fireAt: endsHere,
            startAt: landsAt,
            armedFrom: now,
            audio: audioStyle,
            visual: visualStyle
        )
    }
}

/// An episode that played the track, with the timestamp where it lands.
private struct DiveEpisodeRow: View {
    let appearance: TrackAppearance
    let onTap: () -> Void

    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var downloadsStore: DownloadsStore
    @EnvironmentObject var network: NetworkMonitor

    private var isCurrent: Bool { playerStore.currentEpisode?.id == appearance.episode.id }

    /// Offline, a set we don't have on the device can't be moved into.
    private var unavailable: Bool {
        !network.isOnline && downloadsStore.state(for: appearance.episode.id) != .downloaded
    }

    /// The arranged crossing, when this row is the one on deck.
    private var crossing: QueuedTransition? {
        guard let queued = playerStore.queued,
              queued.episode.id == appearance.episode.id,
              queued.track.order == appearance.track.order
        else { return nil }
        return queued
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                EpisodeArtwork(episode: appearance.episode)
                    .frame(width: 48, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 6))

                VStack(alignment: .leading, spacing: 3) {
                    Text(appearance.episode.name)
                        // On an accent field the playing row earns weight
                        // rather than a second colour.
                        .font(.app(size: 14, weight: isCurrent ? .bold : .semibold))
                        .foregroundColor(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        Text(appearance.episode.formattedDate)
                            .font(.app(size: 12))
                            .foregroundColor(.white.opacity(0.7))

                        Text("·")
                            .foregroundColor(.white.opacity(0.5))

                        Text(appearance.episode.collectiveName)
                            .font(.app(size: 12))
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)

                if let crossing {
                    OnDeckIndicator(
                        crossing: crossing,
                        remaining: playerStore.queuedRemaining ?? 0,
                        isHandingOver: playerStore.isCrossing
                    )
                } else if let timestamp = appearance.track.formattedTimestamp {
                    Text(timestamp)
                        .font(.app(size: 11, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.black.opacity(0.25)))
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(unavailable)
        .opacity(unavailable ? 0.4 : 1)
        // A row that's on deck sits on a lit background — and under the sweep,
        // that light fills across it as the record plays out.
        .background(alignment: .leading) {
            if let crossing {
                if crossing.visual == .sweep {
                    GeometryReader { geo in
                        Rectangle()
                            .fill(Color.white.opacity(0.16))
                            .frame(width: geo.size.width * crossing.progress(at: playerStore.currentTime))
                    }
                } else {
                    Color.white.opacity(0.08)
                }
            }
        }
        .animation(.linear(duration: 0.5), value: playerStore.currentTime)
        .accessibilityHint(crossing == nil ? "" : "On deck. Tap again to call it off.")
    }
}

/// What a row says while it waits its turn. The three takes differ in how
/// loudly they count: a line of text, a draining ring, or the row itself
/// filling up.
private struct OnDeckIndicator: View {
    let crossing: QueuedTransition
    let remaining: Double
    /// True once the crossing is actually under way — the last seconds, where
    /// the two sets are trading places.
    let isHandingOver: Bool

    @State private var pulsing = false

    var body: some View {
        HStack(spacing: 6) {
            if crossing.visual == .ring {
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.25), lineWidth: 2)
                    Circle()
                        .trim(from: 0, to: max(0.02, 1 - elapsed))
                        .stroke(Color.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                .frame(width: 18, height: 18)
            }

            Text(label)
                .font(.app(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundColor(.white)
                .monospacedDigit()
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(Capsule().fill(Color.black.opacity(0.3)))
        .scaleEffect(pulsing ? 1.06 : 1)
        .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: pulsing)
        .onChange(of: isHandingOver) { handing in
            // Only the last seconds pulse, so the badge is calm while it waits
            // and alive once it's actually happening.
            pulsing = handing && crossing.visual != .minimal
        }
    }

    /// How much of the wait is behind us — the ring shows what's left of it.
    private var elapsed: Double {
        crossing.progress(at: crossing.fireAt - remaining)
    }

    private var label: String {
        guard !isHandingOver else { return "CROSSING" }
        let seconds = Int(remaining.rounded())
        return String(format: "ON DECK · %d:%02d", seconds / 60, seconds % 60)
    }
}

// MARK: - Episode screen (the tracks you can leave by)

private struct DiveEpisodeScreen: View {
    let episode: Episode
    /// The track that carried the user here, if they arrived sideways.
    let landedOn: Int?
    @Binding var path: [DiveStep]
    let actions: DiveActions

    @EnvironmentObject var episodesVM: EpisodesViewModel
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var radioStore: RadioStore
    @EnvironmentObject var accents: DiveAccents

    @State private var fetchedTracks: [EpisodeTrack] = []
    @State private var isLoadingTracks = false
    @State private var didFocusLanding = false

    /// Whether arriving in a set scrolls its tracklist to the track that
    /// brought you. On by default; the dive's settings menu toggles it so the
    /// two behaviours can be felt against each other.
    @AppStorage(DiveSettings.focusKey) private var focusLanding = true

    private var isCurrent: Bool { playerStore.currentEpisode?.id == episode.id }

    private var accentColor: AccentColor? { accents.accent(for: episode.id) }
    private var accent: Color { accentColor?.raw ?? Color(white: 0.09) }

    /// The index already carries this set's cue sheet; the fetch below is only
    /// for the rare episode the snapshot has no tracks for.
    private var tracks: [EpisodeTrack] {
        let indexed = episodesVM.trackGraph.tracks(forEpisode: episode.id)
        if !indexed.isEmpty { return indexed }
        if isCurrent, !playerStore.currentTracks.isEmpty { return playerStore.currentTracks }
        return fetchedTracks
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header

                    if tracks.isEmpty {
                        tracklistPlaceholder
                    } else {
                        // The same tracklist the episode sheet renders — same
                        // panel, same rows, same ping on the playing track.
                        // It's the same information, so it reads the same way.
                        TracklistView(
                            tracks: tracks,
                            episode: episode,
                            accent: accent,
                            textColor: .white,
                            graph: episodesVM.trackGraph,
                            onPlay: play,
                            onDive: { track in
                                path.append(.track(TrackAppearance(episode: episode, track: track)))
                            }
                        )
                        .background(Color.black.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 20)
                    }

                    Color.clear.frame(height: 24)
                }
            }
            .onAppear { focusLandedTrack(proxy) }
            .onChange(of: tracks.count) { _ in focusLandedTrack(proxy) }
        }
        .diveChrome(title: episode.name, accent: accent, close: actions.close)
        .task(id: episode.id) {
            await accents.load(episode.id, playing: playerStore)
        }
        .task(id: episode.id) {
            guard tracks.isEmpty else { return }
            if let offline = DownloadsStore.shared.cachedMetadata(for: episode.id), !offline.tracks.isEmpty {
                fetchedTracks = offline.tracks
                return
            }
            isLoadingTracks = true
            fetchedTracks = (try? await APIClient.shared.fetchTracks(episodeId: episode.id)) ?? []
            isLoadingTracks = false
        }
    }

    /// Puts the track you arrived on in front of you, once. Unanimated on
    /// purpose: the push should land already looking at the right row rather
    /// than scrolling once you're staring at the top of the set.
    ///
    /// Twice, a third of a second apart: the first pass rides the same runloop
    /// turn as the push and usually lands it, the second covers the case where
    /// the tracklist hadn't been laid out yet — still early enough to happen
    /// under the push animation, and before there's any user scroll to fight.
    private func focusLandedTrack(_ proxy: ScrollViewProxy) {
        guard focusLanding, !didFocusLanding, let landedOn, !tracks.isEmpty else { return }
        didFocusLanding = true
        for delay in [0.0, 0.35] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                proxy.scrollTo(landedOn, anchor: .center)
            }
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            EpisodeArtwork(episode: episode)
                .frame(width: 88, height: 88)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text(episode.name)
                    .font(.app(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)

                Text("\(episode.formattedDate) · \(episode.formattedDuration)")
                    .font(.app(size: 12))
                    .foregroundColor(.white.opacity(0.7))

                Spacer(minLength: 6)

                Button(action: playFromStart) {
                    HStack(spacing: 5) {
                        Image(systemName: playIcon)
                            .font(.system(size: 11, weight: .semibold))
                        Text(playLabel)
                            .font(.app(size: 12, weight: .semibold))
                    }
                    // White pill, accent-coloured glyph — the episode sheet's
                    // play button, shrunk.
                    .foregroundColor(accent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Color.white))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 18)
    }

    private var playIcon: String {
        isCurrent && playerStore.isPlaying ? "pause.fill" : "play.fill"
    }

    private var playLabel: String {
        guard isCurrent else { return "Play from start" }
        return playerStore.isPlaying ? "Pause" : "Resume"
    }

    private var tracklistPlaceholder: some View {
        VStack(spacing: 8) {
            if isLoadingTracks {
                ProgressView().tint(.white)
            } else {
                Text("No tracklist for this episode")
                    .font(.app(size: 14))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 40)
    }

    private func playFromStart() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        if isCurrent {
            playerStore.togglePlayPause()
            return
        }
        radioStore.tuneOut()
        actions.onLanded(episode)
        Task { await playerStore.play(episode: episode) }
    }

    private func play(_ track: EpisodeTrack) {
        guard let timestamp = track.timestamp else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if isCurrent {
            playerStore.seek(to: Double(timestamp))
            return
        }
        radioStore.tuneOut()
        actions.onLanded(episode)
        Task { await playerStore.play(episode: episode, startingAt: Double(timestamp)) }
    }
}

// MARK: - Chrome

/// Every dive screen looks the same: the album accent of whatever is in view
/// under the episode sheet's darkening gradient, an inline title that doubles
/// as the back button's label one step later, and a way out of the whole dive.
private struct DiveChrome: ViewModifier {
    let title: String
    let accent: Color
    let close: () -> Void

    @AppStorage(DiveSettings.onDeckKey) private var onDeck = false
    @AppStorage(DiveSettings.audioKey) private var audioStyle = TransitionAudio.blend
    @AppStorage(DiveSettings.visualKey) private var visualStyle = TransitionVisual.ring
    @AppStorage(DiveSettings.focusKey) private var focusLanding = true

    func body(content: Content) -> some View {
        content
            .background {
                ZStack {
                    accent
                    LinearGradient(
                        colors: [
                            Color.black.opacity(0.25),
                            Color.black.opacity(0.55),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                }
                .ignoresSafeArea()
            }
            .animation(.easeInOut(duration: 0.5), value: accent)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    settingsMenu

                    Button(action: close) {
                        Text("Done")
                            .font(.app(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
            }
    }

    /// Everything about how a dive behaves, in one place. These are all
    /// "feel the difference" settings, so they live together rather than
    /// spreading across the bar as icons.
    private var settingsMenu: some View {
        Menu {
            Section {
                Toggle(isOn: $onDeck) {
                    Label("Wait for the record to end", systemImage: "hourglass")
                }
                Toggle(isOn: $focusLanding) {
                    Label("Focus the track I arrive on", systemImage: "viewfinder")
                }
            }

            Section("Crossing") {
                Picker("Sound", selection: $audioStyle) {
                    ForEach(TransitionAudio.allCases) { style in
                        Text("\(style.title) · \(style.detail)").tag(style)
                    }
                }
            }

            Section("Countdown") {
                Picker("Look", selection: $visualStyle) {
                    ForEach(TransitionVisual.allCases) { style in
                        Text("\(style.title) · \(style.detail)").tag(style)
                    }
                }
            }
        } label: {
            // The icon carries the one setting that changes what a tap does.
            Image(systemName: onDeck ? "hourglass.circle.fill" : "slider.horizontal.3")
                .font(.system(size: 16))
                .foregroundColor(.white)
        }
        .accessibilityLabel("Dive settings")
    }
}

private extension View {
    func diveChrome(
        title: String,
        accent: Color,
        close: @escaping () -> Void
    ) -> some View {
        modifier(DiveChrome(title: title, accent: accent, close: close))
    }
}
