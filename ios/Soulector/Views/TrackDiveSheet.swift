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

    private var others: [TrackAppearance] {
        episodesVM.trackGraph.otherAppearances(
            of: appearance.track,
            excluding: appearance.episode.id
        )
    }

    /// Painted in the accent of the set this track came from — the screen the
    /// user just stepped off.
    private var accent: Color {
        accents.accent(for: appearance.episode.id)?.raw ?? Color(white: 0.09)
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

    /// Sideways: the same record, in a different set, from the moment it drops.
    private func open(_ other: TrackAppearance) {
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

                if let timestamp = appearance.track.formattedTimestamp {
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
    /// brought you. On by default; the toolbar toggles it so the two
    /// behaviours can be felt against each other.
    @AppStorage("soulector.dive.focusLanding") private var focusLanding = true

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
        .diveChrome(
            title: episode.name,
            accent: accent,
            // Only meaningful on a set you arrived at sideways.
            focus: landedOn == nil ? nil : $focusLanding,
            close: actions.close
        )
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
    /// Present only on screens where landing focus means something.
    let focus: Binding<Bool>?
    let close: () -> Void

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
                    if let focus {
                        Button(action: { focus.wrappedValue.toggle() }) {
                            Image(systemName: focus.wrappedValue ? "viewfinder.circle.fill" : "viewfinder")
                                .font(.system(size: 16))
                                .foregroundColor(.white.opacity(focus.wrappedValue ? 1 : 0.5))
                        }
                        .accessibilityLabel(
                            focus.wrappedValue
                                ? "Stop jumping to the track I arrived on"
                                : "Jump to the track I arrived on"
                        )
                    }

                    Button(action: close) {
                        Text("Done")
                            .font(.app(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
            }
    }
}

private extension View {
    func diveChrome(
        title: String,
        accent: Color,
        focus: Binding<Bool>? = nil,
        close: @escaping () -> Void
    ) -> some View {
        modifier(DiveChrome(title: title, accent: accent, focus: focus, close: close))
    }
}
