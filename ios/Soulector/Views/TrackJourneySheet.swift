import SwiftUI

// MARK: - Connections affordance

/// A track's connections: how many other episodes played this record, and the
/// tap that opens them. Sized to sit at the end of a tracklist row without competing
/// with the row's own tap.
struct TrackConnectionsButton: View {
    let count: Int
    var tint: Color = .white
    let action: () -> Void

    /// Every tracklist row reserves exactly this much room for the connection,
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

/// The connection, or the space where one would be. Tracklist rows always render
/// this so every row's timestamp lands on the same column.
struct TrackConnectionsSlot: View {
    let count: Int
    var tint: Color = .white
    let action: () -> Void

    var body: some View {
        Group {
            if count > 0 {
                TrackConnectionsButton(count: count, tint: tint, action: action)
            } else {
                Color.clear.frame(height: 1)
            }
        }
        .frame(width: TrackConnectionsButton.slotWidth, alignment: .trailing)
    }
}

// MARK: - Journey

/// One step of a journey. Connections only run between kinds — track to
/// episode, episode to track — so the steps alternate: Track Episodes (a track,
/// and the episodes that played it) then Episode Tracks (an episode, and its
/// track list). That's the shape of the data; rendering each as its own pushed
/// screen is this build's answer to it, not the only one. An episode step
/// remembers which track carried you into it, so the screen can put that track
/// in front of you.
enum JourneyStep: Hashable {
    case track(TrackAppearance)
    case episode(Episode, landedOn: Int?)

    /// The set this step is about, whichever kind it is — a Track Episodes step
    /// is still reached *from* an episode. Lets the route be searched for a set
    /// without every caller re-matching both cases.
    var episode: Episode {
        switch self {
        case .track(let appearance):   return appearance.episode
        case .episode(let episode, _): return episode
        }
    }
}

/// The bits every screen in the journey needs but doesn't own.
struct JourneyActions {
    /// Reports the episode the journey is now playing, so the screen underneath
    /// can catch up instead of still showing where the user started.
    let onLanded: (Episode) -> Void
    /// Leaves the journey entirely. `@Environment(\.dismiss)` inside a pushed
    /// screen would only pop a step, so the sheet's own dismiss is passed down.
    let close: () -> Void
}

/// Album accents for the episodes a journey passes through, fetched once and kept
/// for the length of the journey so stepping back through the path doesn't refetch
/// (or re-flash) colours the user has already seen.
@MainActor
final class JourneyAccents: ObservableObject {
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

// MARK: - Track Episodes (the episodes that played this track)

struct TrackEpisodesScreen: View {
    let appearance: TrackAppearance
    @Binding var path: [JourneyStep]
    let actions: JourneyActions

    @EnvironmentObject var episodesVM: EpisodesViewModel
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var radioStore: RadioStore
    @EnvironmentObject var accents: JourneyAccents

    /// Which row has its transition choices out. One at a time, and owned here
    /// rather than by the row, so a tap anywhere on the screen can close it.
    @State private var openRow: String?

    // [journey-variants] what this screen shows and how
    @Environment(\.trackEpisodesStyle) private var style
    @Environment(\.trackEpisodesExtras) private var extras

    private var others: [TrackAppearance] {
        episodesVM.trackGraph.otherAppearances(
            of: appearance.track,
            excluding: appearance.episode.id
        )
    }

    /// Painted in the accent of the set this track came from — the screen the
    /// user just stepped off. With a sweep transition on deck it drifts toward
    /// the colour of the set it's about to hand over to, arriving as the
    /// record ends.
    private var accent: Color {
        guard let base = accents.accent(for: appearance.episode.id) else { return Color(white: 0.09) }
        if let transition = playerStore.queued,
           let destination = accents.accent(for: transition.episode.id) {
            return base
                .blended(toward: destination, amount: transition.progress(at: playerStore.currentTime))
                .raw
        }
        return base.raw
    }

    var body: some View {
        let elsewhere = others

        // [journey-variants] the layouts that don't need a row's open/close
        // state get the simple scroller; only the row list carries choices that
        // have to be dismissable from anywhere.
        switch style {
        case .shelf:      shelfBody(elsewhere)
        case .chronology: simpleBody(elsewhere) { ChronologyList(elsewhere: $0, origin: appearance, onTap: open) }
        case .positions:  simpleBody(elsewhere) { PositionsList(elsewhere: $0, onTap: open) }
        case .hero:       heroBody(elsewhere)
        case .bands:      simpleBody(elsewhere) { destinations in
            BandsList(elsewhere: destinations, accents: accents, onTap: open)
        }
        case .list:       listBody(elsewhere)
        }
    }

    /// [journey-variants] The header/empty/scroll frame the newer layouts share,
    /// so each one only has to say what a destination looks like.
    private func simpleBody<Content: View>(
        _ elsewhere: [TrackAppearance],
        @ViewBuilder content: @escaping ([TrackAppearance]) -> Content
    ) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header(count: elsewhere.count)

                if elsewhere.isEmpty {
                    emptyState
                } else {
                    content(elsewhere)
                }

                Color.clear.frame(height: 24)
            }
        }
        .journeyChrome(title: appearance.track.name, accent: accent, close: actions.close)
        .task(id: appearance.episode.id) {
            await accents.load(appearance.episode.id, playing: playerStore)
        }
        // The painted layout is the only one that needs every destination's
        // colour, so nothing else pays for these.
        .task(id: appearance.id) {
            guard style.needsDestinationAccents else { return }
            for other in elsewhere {
                await accents.load(other.episode.id, playing: playerStore)
            }
        }
    }

    // [journey-variants] the record at size, the sets as a rail beneath it
    private func heroBody(_ elsewhere: [TrackAppearance]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                EpisodeArtwork(episode: appearance.episode)
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, 20)
                    .padding(.top, 4)

                VStack(alignment: .leading, spacing: 4) {
                    Text(appearance.track.name)
                        .font(.app(size: 26, weight: .bold))
                        .foregroundColor(.white)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(appearance.track.artist)
                        .font(.app(size: 16))
                        .foregroundColor(.white.opacity(0.7))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)

                if elsewhere.isEmpty {
                    emptyState
                } else {
                    Text("PLAYED IN \(elsewhere.count + 1) SETS")
                        .font(.app(size: 11, weight: .semibold))
                        .tracking(1)
                        .foregroundColor(.white.opacity(0.5))
                        .padding(.horizontal, 20)
                        .padding(.top, 22)
                        .padding(.bottom, 10)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 12) {
                            HeroChip(appearance: appearance, isHere: true, onTap: {})
                            ForEach(elsewhere) { other in
                                HeroChip(appearance: other, isHere: false) { open(other) }
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }

                Color.clear.frame(height: 24)
            }
        }
        .journeyChrome(title: appearance.track.name, accent: accent, close: actions.close)
        .task(id: appearance.episode.id) {
            await accents.load(appearance.episode.id, playing: playerStore)
        }
    }

    // [journey-variants]
    private func shelfBody(_ elsewhere: [TrackAppearance]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header(count: elsewhere.count)

                if elsewhere.isEmpty {
                    emptyState
                } else {
                    LazyVGrid(
                        columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
                        spacing: 12
                    ) {
                        ForEach(elsewhere) { other in
                            ShelfCard(
                                appearance: other,
                                isOnDeck: playerStore.queued?.episode.id == other.episode.id,
                                onTap: { open(other) },
                                onQueue: { audio in queueTransition(other, with: audio) },
                                canQueue: transitionPoint != nil
                            )
                        }
                    }
                    .padding(.horizontal, 20)
                }

                Color.clear.frame(height: 24)
            }
        }
        .journeyChrome(title: appearance.track.name, accent: accent, close: actions.close)
        .task(id: appearance.episode.id) {
            await accents.load(appearance.episode.id, playing: playerStore)
        }
    }

    private func listBody(_ elsewhere: [TrackAppearance]) -> some View {

        // The geometry is here so the content can be made at least a screen
        // tall: an open row's choices close on a tap anywhere outside them, and
        // "anywhere" has to include the empty space under a short list.
        GeometryReader { geo in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    header(count: elsewhere.count)

                    if elsewhere.isEmpty && !extras.contains(.youAreHere) {
                        emptyState
                    } else {
                        // [journey-variants] the episode you came from, marked
                        if extras.contains(.youAreHere) {
                            HereRow(appearance: appearance)
                        }

                        ForEach(elsewhere) { other in
                            VStack(spacing: 0) {
                                TrackEpisodeRow(
                                    appearance: other,
                                    canQueue: transitionPoint != nil,
                                    accent: accent,
                                    isOpen: openRow == other.id,
                                    onSetOpen: { isOpen in setOpenRow(isOpen ? other.id : nil) },
                                    onTap: { open(other) },
                                    onQueue: { style in queueTransition(other, with: style) },
                                    onCallOff: {
                                        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                                        playerStore.cancelQueued()
                                    }
                                )

                                // [journey-variants] what it comes out of and
                                // into over there — the thing you'd choose on
                                if extras.contains(.landingContext) {
                                    LandingContext(destination: other)
                                }
                            }
                        }
                    }

                    Color.clear.frame(height: 24)
                }
                .frame(minHeight: geo.size.height, alignment: .top)
                .contentShape(Rectangle())
                // Rows and chips take their own taps first; everything that
                // falls through means "put those away".
                .onTapGesture { closeOpenRow(haptic: true) }
            }
            // Scrolling puts them away too, without a second tap.
            .simultaneousGesture(
                DragGesture(minimumDistance: 8).onChanged { _ in closeOpenRow(haptic: false) }
            )
        }
        .journeyChrome(title: appearance.track.name, accent: accent, close: actions.close)
        .task(id: appearance.episode.id) {
            await accents.load(appearance.episode.id, playing: playerStore)
        }
    }

    private func setOpenRow(_ id: String?) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        withAnimation(.spring(response: 0.34, dampingFraction: 0.78)) { openRow = id }
    }

    private func closeOpenRow(haptic: Bool) {
        guard openRow != nil else { return }
        if haptic { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
        withAnimation(.spring(response: 0.34, dampingFraction: 0.78)) { openRow = nil }
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

    /// Sideways, now: the same record, in a different set, from the moment it
    /// drops. Waiting for the outro is the row menu's job — a tap is always
    /// the direct route.
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

    private var transitionPoint: Double? {
        QueuedTransition.transitionPoint(player: playerStore)
    }

    /// Arranges the transition this row's menu asked for.
    private func queueTransition(_ other: TrackAppearance, with audio: TransitionAudio) {
        guard let transition = QueuedTransition.plan(
            to: other,
            audio: audio,
            player: playerStore,
            graph: episodesVM.trackGraph
        ) else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        playerStore.queue(transition)
        // Load the destination's accent now: the sweep drifts this screen's
        // colour toward it while the record plays out.
        Task { await accents.load(other.episode.id, playing: playerStore) }
    }
}

/// An episode that played the track. Tapping it goes there now; the control on
/// its right holds the slower way — waiting for the record to end.
struct TrackEpisodeRow: View {
    let appearance: TrackAppearance
    /// Whether there's a record playing that a transition could hang off.
    let canQueue: Bool
    /// The screen's album accent, worn by the badge once something is armed.
    let accent: Color
    /// Whether this row's control is open on its choices. Owned by the screen —
    /// only one row can be open, and a tap anywhere closes it.
    let isOpen: Bool
    let onSetOpen: (Bool) -> Void
    let onTap: () -> Void
    let onQueue: (TransitionAudio) -> Void
    let onCallOff: () -> Void

    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var downloadsStore: DownloadsStore
    @EnvironmentObject var network: NetworkMonitor
    // [journey-variants]
    @Environment(\.armedRowStyle) private var armedRowStyle

    private var isCurrent: Bool { playerStore.currentEpisode?.id == appearance.episode.id }

    /// Offline, a set we don't have on the device can't be moved into.
    private var unavailable: Bool {
        !network.isOnline && downloadsStore.state(for: appearance.episode.id) != .downloaded
    }

    /// The arranged transition, when this row is the one on deck.
    private var transition: QueuedTransition? {
        guard let queued = playerStore.queued,
              queued.episode.id == appearance.episode.id,
              queued.track.order == appearance.track.order
        else { return nil }
        return queued
    }

    var body: some View {
        // The tap area and the control are siblings rather than one nested in
        // the other, so each keeps its own taps.
        HStack(spacing: 12) {
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

                    // Once something is arranged, the row says so in words —
                    // the badge alone was too small to carry the news.
                    if let transition {
                        HStack(spacing: 5) {
                            Image(systemName: transition.audio.symbol)
                                .font(.system(size: 9, weight: .bold))
                            Text(statusLine(for: transition))
                                .font(.app(size: 11, weight: .bold))
                                .tracking(0.7)
                                .lineLimit(1)
                        }
                        .foregroundColor(.white)
                        .transition(.opacity)
                    } else {
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
                        .transition(.opacity)
                    }
                }

                Spacer(minLength: 8)
            }
            // The row steps back while its choices are out, so the tray reads
            // as being on top of it rather than crowded in beside it.
            .opacity(isOpen ? 0.3 : 1)
            .contentShape(Rectangle())
            .onTapGesture {
                // With the choices open, a tap on the row puts them away
                // rather than moving the user.
                if isOpen {
                    onSetOpen(false)
                    return
                }
                guard !unavailable else { return }
                onTap()
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)

            trailingControl
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .opacity(unavailable ? 0.4 : 1)
        // A row that's on deck sits on a lit background — and under the sweep,
        // that light fills across it as the record plays out.
        // [journey-variants] three ways for an armed row to mark itself
        .background(alignment: .leading) {
            if let transition {
                let filled = transition.progress(at: playerStore.currentTime)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        switch armedRowStyle {
                        case .sweep:
                            Rectangle()
                                .fill(Color.white.opacity(0.16))
                                .frame(width: geo.size.width * filled)
                        case .card:
                            // The same fill, inset and rounded, so it reads as
                            // a card filling rather than a selection that ran
                            // off both sides of the screen.
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.white.opacity(0.08))
                                .padding(.horizontal, 12)
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.white.opacity(0.16))
                                .frame(width: max(0, (geo.size.width - 24) * filled))
                                .padding(.leading, 12)
                        case .bar:
                            // How the tracklist already marks what's playing,
                            // borrowed so the two agree.
                            Rectangle()
                                .fill(Color.white.opacity(0.08))
                            Rectangle()
                                .fill(Color.white)
                                .frame(width: 3)
                        }
                    }
                    // Scoped to the fill: the clock ticks twice a second,
                    // and animating the whole row on that beat would drag
                    // everything else along with it.
                    .animation(.linear(duration: 0.5), value: playerStore.currentTime)
                }
            }
        }
        // The choices unfold over the row rather than shoving its text aside.
        .overlay(alignment: .trailing) {
            if isOpen {
                TransitionChoices(
                    armed: transition?.audio,
                    canQueue: canQueue,
                    onPick: { style in
                        onSetOpen(false)
                        onQueue(style)
                    },
                    onCallOff: {
                        onSetOpen(false)
                        onCallOff()
                    }
                )
                .padding(.trailing, 20)
                // Grown out of the button it replaced, at the same edge.
                .transition(.scale(scale: 0.2, anchor: .trailing).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: transition?.id)
    }

    /// Idle, this is the landing time and the way in. Armed, it's the
    /// countdown. Open, it's neither — the choices have taken its place.
    private var trailingControl: some View {
        HStack(spacing: 8) {
            if let transition {
                TransitionBadge(
                    transition: transition,
                    remaining: playerStore.queuedRemaining ?? 0,
                    isTransitioning: playerStore.isTransitioning,
                    accent: accent
                )
            } else if let timestamp = appearance.track.formattedTimestamp {
                Text(timestamp)
                    .font(.app(size: 11, weight: .medium))
                    .foregroundColor(.white)
                    .monospacedDigit()
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.black.opacity(0.25)))
            }

            Button(action: { onSetOpen(!isOpen) }) {
                // "Put this next" — the same thing the armed row says in words
                // ("ON DECK") and the episode sheet shows in its panel.
                Image(systemName: "text.append")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Color.black.opacity(0.3)))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(unavailable)
            .accessibilityLabel("Transition options")
        }
        // The button doesn't sit next to its own expansion — it becomes it.
        .opacity(isOpen ? 0 : 1)
    }

    private func statusLine(for transition: QueuedTransition) -> String {
        playerStore.isTransitioning
            ? "IN TRANSITION"
            : "ON DECK · \(transition.audio.title.uppercased())"
    }
}

/// The control's open state: the three ways across, laid out in the row itself
/// rather than in a menu over it, so picking one is part of the same gesture
/// that opened it.
struct TransitionChoices: View {
    /// The style already arranged, if this row is on deck.
    let armed: TransitionAudio?
    let canQueue: Bool
    let onPick: (TransitionAudio) -> Void
    let onCallOff: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            if canQueue {
                ForEach(TransitionAudio.allCases) { style in
                    let isArmed = armed == style
                    chip(
                        title: style.title,
                        symbol: style.symbol,
                        filled: isArmed,
                        // The lit one is the way out as well as the way in:
                        // tapping what's already arranged calls it off.
                        action: { isArmed ? onCallOff() : onPick(style) }
                    )
                }
            } else {
                Text("Nothing playing to transition from")
                    .font(.app(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.75))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
            }
        }
        .padding(5)
        .background(Capsule().fill(.ultraThinMaterial))
        .background(Capsule().fill(Color.black.opacity(0.35)))
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.18), lineWidth: 1))
    }

    private func chip(
        title: String,
        symbol: String,
        filled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .semibold))
                Text(title)
                    .font(.app(size: 11, weight: .semibold))
            }
            .foregroundColor(filled ? .black : .white)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(Capsule().fill(filled ? Color.white : Color.white.opacity(0.16)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// The armed state: a white pill wearing the screen's accent, which is how the
/// rest of the app marks the one thing that's live. It counts the record down
/// and pulses once the two sets are actually trading places.
struct TransitionBadge: View {
    let transition: QueuedTransition
    let remaining: Double
    let isTransitioning: Bool
    let accent: Color

    @State private var pulsing = false

    var body: some View {
        // The wait is drawn by the row filling behind it, so the badge itself
        // only has to say how long is left.
        Text(countdown)
            .font(.app(size: 12, weight: .bold))
            .monospacedDigit()
            .foregroundColor(accent)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(Color.white))
        .scaleEffect(pulsing ? 1.07 : 1)
        .animation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true), value: pulsing)
        .onChange(of: isTransitioning) { handing in
            // Calm while it waits, alive once it's happening.
            pulsing = handing
        }
    }

    private var countdown: String {
        guard !isTransitioning else { return "NOW" }
        let seconds = Int(remaining.rounded())
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}


// MARK: - Episode Tracks (the tracks you can leave by)

struct EpisodeTracksScreen: View {
    let episode: Episode
    /// The track that carried the user here, if they arrived sideways.
    let landedOn: Int?
    @Binding var path: [JourneyStep]
    let actions: JourneyActions

    @EnvironmentObject var episodesVM: EpisodesViewModel
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var radioStore: RadioStore
    @EnvironmentObject var accents: JourneyAccents

    @State private var fetchedTracks: [EpisodeTrack] = []
    @State private var isLoadingTracks = false
    @State private var didFocusLanding = false

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
                            onOpenConnections: { track in
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
        .journeyChrome(
            title: episode.name,
            accent: accent,
            // [journey-variants]
            path: $path,
            viewed: episode,
            onReturn: { landed in path.append(.episode(landed, landedOn: nil)) },
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
        guard !didFocusLanding, let landedOn, !tracks.isEmpty else { return }
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

/// Every journey screen looks the same: the album accent of whatever is in view
/// under the episode sheet's darkening gradient, an inline title that doubles
/// as the back button's label one step later, and a way out of the whole journey.
struct JourneyChrome: ViewModifier {
    let title: String
    let accent: Color
    // [journey-variants] the rail needs the route to draw it
    var path: Binding<[JourneyStep]>? = nil
    var viewed: Episode? = nil
    var onReturn: ((Episode) -> Void)? = nil
    let close: () -> Void

    // [journey-variants]
    @Environment(\.journeyLayers) private var layers
    @Environment(\.journeyNavigation) private var variant

    func body(content: Content) -> some View {
        content
            .background {
                // [journey-variants] full screen reads as a page in the app, not
                // a sheet wearing an album — so the accent washes down from the
                // top over the app's own black rather than flooding the screen.
                // The drift between accents still animates either way, which is
                // what tells you the ground has changed under a transition.
                Group {
                    if variant == .fullScreen {
                        ZStack {
                            Color.black
                            LinearGradient(
                                colors: [accent.opacity(0.85), accent.opacity(0.12), .clear],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                            .frame(maxHeight: 320, alignment: .top)
                            .frame(maxHeight: .infinity, alignment: .top)
                        }
                    } else {
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
                    }
                }
                .ignoresSafeArea()
            }
            .animation(.easeInOut(duration: 0.5), value: accent)
            // [journey-variants] layers ride above whatever the screen draws
            .safeAreaInset(edge: .top, spacing: 0) {
                VStack(spacing: 0) {
                    if layers.contains(.nowPlayingStrip), let viewed, let onReturn {
                        NowPlayingStrip(viewed: viewed, onReturn: onReturn)
                    }
                    if layers.contains(.routeRail), let path {
                        RouteRail(path: path)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: close) {
                        Text("Done")
                            .font(.app(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
            }
    }
}

extension View {
    func journeyChrome(
        title: String,
        accent: Color,
        // [journey-variants] optional so non-journey callers stay unchanged
        path: Binding<[JourneyStep]>? = nil,
        viewed: Episode? = nil,
        onReturn: ((Episode) -> Void)? = nil,
        close: @escaping () -> Void
    ) -> some View {
        modifier(JourneyChrome(
            title: title,
            accent: accent,
            path: path,
            viewed: viewed,
            onReturn: onReturn,
            close: close
        ))
    }
}
