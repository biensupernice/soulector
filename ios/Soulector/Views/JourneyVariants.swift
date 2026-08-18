import SwiftUI

// =============================================================================
// [journey-variants] EXPLORATION CODE — meant to be deleted.
//
// Everything in this file exists to try navigation approaches against each
// other. When one wins it moves into the real views and this file goes, along
// with `JourneyNavigation`, `JourneyLayers` and every `[journey-variants]`
// marker elsewhere. `ios/docs/journey-variants.md` holds the removal list.
// =============================================================================

// MARK: - Shared destinations

/// The two journey screens, wired to a path. Identical in every variant that
/// pushes — only the container around them differs — so it lives once here
/// rather than being copied into each host.
struct JourneyDestinations: ViewModifier {
    @Binding var path: [JourneyStep]
    let actions: JourneyActions

    func body(content: Content) -> some View {
        content.navigationDestination(for: JourneyStep.self) { step in
            switch step {
            case .track(let appearance):
                TrackEpisodesScreen(appearance: appearance, path: $path, actions: actions)
                    .onAppear { Diagnostics.breadcrumb("push · Track Episodes · \(appearance.track.name)") }
            case .episode(let episode, let landedOn):
                EpisodeTracksScreen(episode: episode, landedOn: landedOn, path: $path, actions: actions)
                    .onAppear { Diagnostics.breadcrumb("push · Episode Tracks · \(episode.name)") }
            }
        }
    }
}

extension View {
    func journeyDestinations(path: Binding<[JourneyStep]>, actions: JourneyActions) -> some View {
        modifier(JourneyDestinations(path: path, actions: actions))
    }
}


// MARK: - Going across, from an in-place variant

/// Peek and inline lost the slower way across when they stopped using the
/// journey's own rows: you could go there now, but not arrange the handover on
/// the record you're both playing. This is that control, small enough to sit in
/// a compact row — the same `TransitionAudio` choices, the same
/// `PlayerStore.queue`, just a tighter frame.
struct InPlaceTransitionControl: View {
    let destination: TrackAppearance
    let tint: Color

    @EnvironmentObject private var playerStore: PlayerStore
    @EnvironmentObject private var episodesVM: EpisodesViewModel

    /// A transition hangs off the record playing now, so there has to be one.
    private var canQueue: Bool { QueuedTransition.transitionPoint(player: playerStore) != nil }

    private var armed: QueuedTransition? {
        guard let queued = playerStore.queued,
              queued.episode.id == destination.episode.id,
              queued.track.order == destination.track.order
        else { return nil }
        return queued
    }

    var body: some View {
        Menu {
            if let armed {
                Button(role: .destructive) {
                    playerStore.cancelQueued()
                } label: {
                    Label("Call off \(armed.audio.title)", systemImage: "xmark")
                }
            } else if canQueue {
                ForEach(TransitionAudio.allCases) { style in
                    Button {
                        guard let transition = QueuedTransition.plan(
                            to: destination,
                            audio: style,
                            player: playerStore,
                            graph: episodesVM.trackGraph
                        ) else { return }
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        playerStore.queue(transition)
                    } label: {
                        Label("\(style.title) · \(style.detail)", systemImage: style.symbol)
                    }
                }
            } else {
                Text("Nothing playing to transition from")
            }
        } label: {
            Image(systemName: armed == nil ? "text.append" : armed!.audio.symbol)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(armed == nil ? tint : .black)
                .frame(width: 26, height: 26)
                .background(Circle().fill(armed == nil ? Color.black.opacity(0.3) : Color.white))
                .contentShape(Circle())
        }
        .accessibilityLabel("Transition options")
    }
}

// MARK: - Peek

/// Track Episodes as a look rather than a place: a short sheet you can flick
/// away at no cost, listing where else this record turns up. Picking one plays
/// it and hands the episode sheet underneath over to it, so the journey never
/// grows a stack.
struct PeekConnections: View {
    let appearance: TrackAppearance
    let accent: Color
    /// Called with the episode picked, after playback has been pointed at it.
    let onPick: (Episode) -> Void

    @EnvironmentObject private var episodesVM: EpisodesViewModel
    @EnvironmentObject private var playerStore: PlayerStore
    @EnvironmentObject private var radioStore: RadioStore
    @Environment(\.dismiss) private var dismiss

    private var others: [TrackAppearance] {
        episodesVM.trackGraph.otherAppearances(
            of: appearance.track,
            excluding: appearance.episode.id
        )
    }

    var body: some View {
        ZStack {
            accent.ignoresSafeArea()
            LinearGradient(
                colors: [Color.black.opacity(0.25), Color.black.opacity(0.55)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(appearance.track.name)
                        .font(.app(size: 15, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Text("ALSO PLAYED IN \(others.count) OTHER \(others.count == 1 ? "EPISODE" : "EPISODES")")
                        .font(.app(size: 11, weight: .bold))
                        .tracking(0.8)
                        .foregroundColor(.white.opacity(0.6))
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 10)

                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(others) { other in
                            HStack(spacing: 10) {
                            Button {
                                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                                radioStore.tuneOut()
                                let at = Double(other.track.timestamp ?? 0)
                                Task { await playerStore.play(episode: other.episode, startingAt: at) }
                                onPick(other.episode)
                                dismiss()
                            } label: {
                                HStack(spacing: 12) {
                                    EpisodeArtwork(episode: other.episode)
                                        .frame(width: 40, height: 40)
                                        .clipShape(RoundedRectangle(cornerRadius: 6))

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(other.episode.name)
                                            .font(.app(size: 14, weight: .semibold))
                                            .foregroundColor(.white)
                                            .lineLimit(1)
                                        Text(other.episode.formattedDate)
                                            .font(.app(size: 12))
                                            .foregroundColor(.white.opacity(0.7))
                                    }

                                    Spacer(minLength: 8)

                                    if let ts = other.track.formattedTimestamp {
                                        Text(ts)
                                            .font(.app(size: 11, weight: .medium))
                                            .monospacedDigit()
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(Capsule().fill(Color.black.opacity(0.25)))
                                            .layoutPriority(1)
                                    }
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)

                            // Sibling of the row's tap, not nested in it — a
                            // button inside a button eats both.
                            InPlaceTransitionControl(destination: other, tint: .white)
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                        }
                    }
                    .padding(.bottom, 12)
                }
            }
        }
    }
}

// MARK: - Inline

/// Track Episodes with no surface at all: the connections unfold under the row
/// that has them, and picking one hands the sheet over in place. The reverse
/// index as content rather than a destination.
struct InlineConnections: View {
    let appearance: TrackAppearance
    let textColor: Color
    let onPick: (Episode) -> Void

    @EnvironmentObject private var episodesVM: EpisodesViewModel
    @EnvironmentObject private var playerStore: PlayerStore
    @EnvironmentObject private var radioStore: RadioStore

    private var others: [TrackAppearance] {
        episodesVM.trackGraph.otherAppearances(
            of: appearance.track,
            excluding: appearance.episode.id
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(others) { other in
                // Genuine siblings in one row: the tap area and the control
                // sit side by side, so the control has its own space instead
                // of being laid over the timestamp.
                HStack(spacing: 8) {
                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        radioStore.tuneOut()
                        let at = Double(other.track.timestamp ?? 0)
                        Task { await playerStore.play(episode: other.episode, startingAt: at) }
                        onPick(other.episode)
                    } label: {
                        HStack(spacing: 10) {
                            // The elbow says these hang off the row above rather
                            // than being more of the tracklist.
                            Rectangle()
                                .fill(textColor.opacity(0.35))
                                .frame(width: 1, height: 28)

                            EpisodeArtwork(episode: other.episode)
                                .frame(width: 28, height: 28)
                                .clipShape(RoundedRectangle(cornerRadius: 4))

                            Text(other.episode.name)
                                .font(.app(size: 12, weight: .medium))
                                .foregroundColor(textColor)
                                .lineLimit(1)

                            Spacer(minLength: 6)

                            if let ts = other.track.formattedTimestamp {
                                Text(ts)
                                    .font(.app(size: 11))
                                    .monospacedDigit()
                                    .foregroundColor(textColor.opacity(0.8))
                                    .layoutPriority(1)
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    InPlaceTransitionControl(destination: other, tint: textColor)
                }
                .padding(.leading, 36)
                .padding(.trailing, 14)
                .padding(.vertical, 4)
            }
        }
        .padding(.bottom, 6)
    }
}

// MARK: - Layers

/// The route as album art you can tap: the path made visible and jumpable,
/// against a back stack that only walks backwards one step at a time.
struct RouteRail: View {
    @Binding var path: [JourneyStep]

    private var stops: [(index: Int, episode: Episode)] {
        path.enumerated().compactMap { index, step in
            if case .episode(let episode, _) = step { return (index, episode) }
            return nil
        }
    }

    var body: some View {
        if stops.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(stops, id: \.index) { stop in
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            // Jumping back is truncation: everything after the
                            // step you picked stops being where you are.
                            path = Array(path.prefix(stop.index + 1))
                        } label: {
                            EpisodeArtwork(episode: stop.episode)
                                .frame(width: 30, height: 30)
                                .clipShape(RoundedRectangle(cornerRadius: 5))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 5)
                                        .strokeBorder(
                                            Color.white.opacity(stop.index == path.count - 1 ? 0.9 : 0.2),
                                            lineWidth: 1.5
                                        )
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 6)
            }
        }
    }
}

/// Names both threads at once, and offers the way back to the one that's
/// making noise — but only when they've actually come apart.
struct NowPlayingStrip: View {
    let viewed: Episode
    let onReturn: (Episode) -> Void

    @EnvironmentObject private var playerStore: PlayerStore

    var body: some View {
        if let current = playerStore.currentEpisode, current.id != viewed.id {
            HStack(spacing: 8) {
                Text("PLAYING")
                    .font(.app(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(.white.opacity(0.55))

                Text(current.name)
                    .font(.app(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)

                Spacer(minLength: 6)

                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onReturn(current)
                } label: {
                    Text("Return")
                        .font(.app(size: 11, weight: .bold))
                        .foregroundColor(.black)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Color.white))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 6)
            .background(Color.black.opacity(0.25))
        }
    }
}

// MARK: - What Track Episodes shows

/// The episode you came from, standing in the list with the others. A record
/// with one connection then reads as a fact about two episodes rather than a
/// stub — and it's the truer statement: this record's homes include this one.
struct HereRow: View {
    let appearance: TrackAppearance

    var body: some View {
        HStack(spacing: 12) {
            EpisodeArtwork(episode: appearance.episode)
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(.white.opacity(0.5), lineWidth: 1.5))

            VStack(alignment: .leading, spacing: 3) {
                Text(appearance.episode.name)
                    .font(.app(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(2)

                Text("YOU ARE HERE")
                    .font(.app(size: 11, weight: .bold))
                    .tracking(0.7)
                    .foregroundColor(.white.opacity(0.6))
            }

            Spacer(minLength: 8)

            if let ts = appearance.track.formattedTimestamp {
                Text(ts)
                    .font(.app(size: 11, weight: .medium))
                    .monospacedDigit()
                    .foregroundColor(.white.opacity(0.8))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.black.opacity(0.2)))
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .opacity(0.75)
    }
}

/// What the record comes out of and goes into over there. A list of episode
/// names says where you could go; this says what it would sound like when you
/// arrive, which is the thing worth choosing on.
struct LandingContext: View {
    let destination: TrackAppearance

    @EnvironmentObject private var episodesVM: EpisodesViewModel

    /// The record before and after it in that episode's cue sheet.
    private var neighbours: (before: EpisodeTrack?, after: EpisodeTrack?) {
        let tracks = episodesVM.trackGraph.tracks(forEpisode: destination.episode.id)
        guard let index = tracks.firstIndex(where: { $0.order == destination.track.order }) else {
            return (nil, nil)
        }
        return (
            index > 0 ? tracks[index - 1] : nil,
            index + 1 < tracks.count ? tracks[index + 1] : nil
        )
    }

    var body: some View {
        let sides = neighbours
        if sides.before != nil || sides.after != nil {
            VStack(alignment: .leading, spacing: 3) {
                if let before = sides.before {
                    line(mark: "arrow.up", track: before)
                }
                if let after = sides.after {
                    line(mark: "arrow.down", track: after)
                }
            }
            .padding(.leading, 76)
            .padding(.trailing, 20)
            .padding(.bottom, 8)
        }
    }

    private func line(mark: String, track: EpisodeTrack) -> some View {
        HStack(spacing: 6) {
            Image(systemName: mark)
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(.white.opacity(0.4))
            Text("\(track.name) · \(track.artist)")
                .font(.app(size: 11))
                .foregroundColor(.white.opacity(0.55))
                .lineLimit(1)
        }
    }
}

/// A destination as artwork rather than a row. Two across, so one to four
/// connections fill a screen the way a list of one never will.
struct ShelfCard: View {
    let appearance: TrackAppearance
    let isOnDeck: Bool
    let onTap: () -> Void
    let onQueue: (TransitionAudio) -> Void
    let canQueue: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                Button(action: onTap) {
                    EpisodeArtwork(episode: appearance.episode)
                        .aspectRatio(1, contentMode: .fill)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay {
                            if isOnDeck {
                                RoundedRectangle(cornerRadius: 10)
                                    .strokeBorder(.white, lineWidth: 2)
                            }
                        }
                }
                .buttonStyle(.plain)

                // The slower way across, kept out of the artwork's own tap.
                Menu {
                    if canQueue {
                        ForEach(TransitionAudio.allCases) { style in
                            Button { onQueue(style) } label: {
                                Label("\(style.title) · \(style.detail)", systemImage: style.symbol)
                            }
                        }
                    } else {
                        Text("Nothing playing to transition from")
                    }
                } label: {
                    Image(systemName: "text.append")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(Color.black.opacity(0.45)))
                }
                .padding(6)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(appearance.episode.name)
                    .font(.app(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if let ts = appearance.track.formattedTimestamp {
                    Text("plays at \(ts)")
                        .font(.app(size: 11))
                        .monospacedDigit()
                        .foregroundColor(.white.opacity(0.6))
                }
            }
        }
    }
}

// MARK: - Track Episodes cards [journey-variants]

/// A destination as a card big enough to answer "what am I walking into",
/// which is the question that turned out to matter — arriving somewhere is
/// easier to choose than going somewhere.
///
/// The three card layouts differ only in the panel in the middle. Everything
/// else, including the queue control, lives here: a variant can't ship without
/// the slower way across because it never had the chance to forget it.
struct DestinationCard: View {
    let destination: TrackAppearance
    let context: TrackEpisodesStyle
    /// The transition already arranged for this destination, if it's on deck.
    /// The whole thing rather than just its style, because the countdown needs
    /// `progress(at:)` as well as the name of what was picked.
    let armed: QueuedTransition?
    let canQueue: Bool
    let onTap: () -> Void
    let onQueue: (TransitionAudio) -> Void
    let onCallOff: () -> Void

    @EnvironmentObject private var playerStore: PlayerStore
    // [journey-variants] the same countdown treatments the rows offer
    @Environment(\.armedRowStyle) private var armedRowStyle

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // The whole head is "go there now". The chips below are the slower
            // way, and they're outside this button so a tap meant for one never
            // lands on the other.
            Button(action: onTap) {
                HStack(spacing: 12) {
                    EpisodeArtwork(episode: destination.episode)
                        .frame(width: 60, height: 60)
                        .clipShape(RoundedRectangle(cornerRadius: 9))

                    VStack(alignment: .leading, spacing: 3) {
                        Text(destination.episode.name)
                            .font(.app(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        HStack(spacing: 5) {
                            Text(destination.episode.formattedDate)
                            if let ts = destination.track.formattedTimestamp {
                                Text("·")
                                Text("drops at \(ts)").monospacedDigit()
                            }
                        }
                        .font(.app(size: 12))
                        .foregroundColor(.white.opacity(0.6))
                    }

                    Spacer(minLength: 0)

                    Image(systemName: "play.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(Color.white.opacity(0.16)))
                }
            }
            .buttonStyle(.plain)

            switch context {
            case .runway: RunwayPanel(destination: destination)
            case .arc:    ArcPanel(destination: destination)
            default:      LandingPanel(destination: destination)
            }

            TransitionChoices(
                armed: armed?.audio,
                canQueue: canQueue,
                onPick: onQueue,
                onCallOff: onCallOff
            )
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.07)))
        // [journey-variants] the countdown. Clipped to the card's own shape so
        // a fill can run the full width without squaring off its corners.
        .background {
            if let armed {
                countdown(filled: armed.progress(at: playerStore.currentTime))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
        // The outline is how an armed card marks itself, in every style. It
        // reads better than anything drawn inside the card, and unlike a fill
        // it's already there at zero progress.
        .overlay(
            RoundedRectangle(cornerRadius: 16).strokeBorder(
                armed != nil ? Color.white.opacity(0.85) : Color.white.opacity(0.10),
                lineWidth: armed != nil ? 2 : 1
            )
        )
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: armed?.id)
    }

    /// The wait, drawn. Same three treatments the rows offer, plus the outline
    /// -only case the cards started with.
    @ViewBuilder
    private func countdown(filled: Double) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                switch armedRowStyle {
                case .sweep:
                    Rectangle()
                        .fill(Color.white.opacity(0.16))
                        .frame(width: geo.size.width * filled)
                case .card:
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.white.opacity(0.08))
                        .padding(8)
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.white.opacity(0.16))
                        .frame(width: max(0, (geo.size.width - 16) * filled))
                        .padding(.leading, 8)
                case .bar:
                    // No side bar on a card. A bar down the left is how a row
                    // marks itself *because* a row has no outline; a card does,
                    // and the outline is the better mark — the two stacked piled
                    // white on the left edge and the corner radius pinched the
                    // bar's ends. So the card's answer to "bar" is its outline,
                    // over the same quiet wash the row lays down.
                    Rectangle().fill(Color.white.opacity(0.08))
                case .border:
                    // The outline is already drawn by the card. Nothing counts
                    // down, which is the point of having it to compare against.
                    EmptyView()
                }
            }
            // Scoped to the fill: the clock ticks twice a second, and animating
            // the whole card on that beat would drag its content along.
            .animation(.linear(duration: 0.5), value: playerStore.currentTime)
        }
    }
}

/// Where the record sits in a set, as a fraction and in words. Shared so the
/// three panels can't drift on what "deep in it" means.
struct LandingPosition {
    let fraction: Double?

    init(_ appearance: TrackAppearance) {
        guard let ts = appearance.track.timestamp, appearance.episode.duration > 0 else {
            fraction = nil
            return
        }
        fraction = min(1, max(0, Double(ts) / Double(appearance.episode.duration)))
    }

    /// The picture in words, because a mark two thirds along a bar is the
    /// drawing and "near the close" is the point of it.
    var phrase: String {
        guard let fraction else { return "somewhere in the set" }
        switch fraction {
        case ..<0.12:  return "opens the set"
        case ..<0.38:  return "early on"
        case ..<0.68:  return "deep in it"
        case ..<0.88:  return "late in the set"
        default:       return "near the close"
        }
    }
}

/// The bar every card layout leans on: the set at its own length with the drop
/// marked in it.
struct LandingBar: View {
    let fraction: Double?
    var height: CGFloat = 4

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.white.opacity(0.14))
                    .frame(height: height)

                if let fraction {
                    Capsule()
                        .fill(Color.white.opacity(0.30))
                        .frame(width: geo.size.width * fraction, height: height)

                    // Held inside the bar at both ends, so an opener doesn't
                    // render as a mark hanging off the left edge.
                    Capsule()
                        .fill(Color.white)
                        .frame(width: 3, height: height + 8)
                        .offset(x: min(geo.size.width - 3, max(0, geo.size.width * fraction - 1.5)))
                }
            }
            .frame(height: height + 8)
        }
        .frame(height: height + 8)
    }
}

/// Position in the set, named, plus the record you'd come out into — the two
/// facts that make an arrival imaginable.
private struct LandingPanel: View {
    let destination: TrackAppearance

    @EnvironmentObject private var episodesVM: EpisodesViewModel

    private var next: EpisodeTrack? {
        let tracks = episodesVM.trackGraph.tracks(forEpisode: destination.episode.id)
        guard let i = tracks.firstIndex(where: { $0.order == destination.track.order }),
              i + 1 < tracks.count else { return nil }
        return tracks[i + 1]
    }

    var body: some View {
        let position = LandingPosition(destination)

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(position.phrase)
                    .font(.app(size: 12, weight: .medium))
                    .foregroundColor(.white.opacity(0.72))
                Spacer(minLength: 0)
                Text(destination.episode.formattedDuration)
                    .font(.app(size: 11))
                    .monospacedDigit()
                    .foregroundColor(.white.opacity(0.4))
            }

            LandingBar(fraction: position.fraction)

            if let next {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.turn.down.right")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white.opacity(0.4))
                    Text("then \(next.name) · \(next.artist)")
                        .font(.app(size: 11))
                        .foregroundColor(.white.opacity(0.6))
                        .lineLimit(1)
                }
            }
        }
    }
}

private struct RunwayStop: Identifiable {
    let track: EpisodeTrack
    let isDrop: Bool
    var id: Int { track.order }
}

/// The cue sheet around the drop: one before for footing, the record itself,
/// two after. Shows the stretch you'd walk rather than describing it.
private struct RunwayPanel: View {
    let destination: TrackAppearance

    @EnvironmentObject private var episodesVM: EpisodesViewModel

    private var window: [RunwayStop] {
        let tracks = episodesVM.trackGraph.tracks(forEpisode: destination.episode.id)
        guard let i = tracks.firstIndex(where: { $0.order == destination.track.order }) else { return [] }
        let lower = max(0, i - 1)
        let upper = min(tracks.count - 1, i + 2)
        return tracks[lower...upper].map {
            RunwayStop(track: $0, isDrop: $0.order == destination.track.order)
        }
    }

    var body: some View {
        let stops = window

        if stops.isEmpty {
            Text("No cue sheet for this set")
                .font(.app(size: 11))
                .foregroundColor(.white.opacity(0.45))
        } else {
            VStack(alignment: .leading, spacing: 5) {
                ForEach(stops) { stop in
                    HStack(spacing: 8) {
                        // The drop is the only lit mark; everything else is
                        // there to give it somewhere to sit.
                        Circle()
                            .fill(stop.isDrop ? Color.white : Color.white.opacity(0.28))
                            .frame(width: stop.isDrop ? 7 : 4, height: stop.isDrop ? 7 : 4)
                            .frame(width: 8)

                        Text(stop.track.name)
                            .font(.app(size: 12, weight: stop.isDrop ? .semibold : .regular))
                            .foregroundColor(.white.opacity(stop.isDrop ? 1 : 0.55))
                            .lineLimit(1)

                        Spacer(minLength: 4)

                        if let ts = stop.track.formattedTimestamp {
                            Text(ts)
                                .font(.app(size: 10))
                                .monospacedDigit()
                                .foregroundColor(.white.opacity(stop.isDrop ? 0.8 : 0.35))
                        }
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }
}

/// The whole set as a strip of its track marks with the drop lit. Says how
/// dense the set is and where you enter it — "deep in it" only approximates
/// both.
private struct ArcPanel: View {
    let destination: TrackAppearance

    @EnvironmentObject private var episodesVM: EpisodesViewModel

    /// Every track that knows when it plays, as a fraction of the set. A struct
    /// rather than a tuple because `ForEach` needs a key path to identify by,
    /// and tuple elements don't have one.
    private struct Mark: Identifiable {
        let order: Int
        let at: Double
        var id: Int { order }
    }

    private var marks: [Mark] {
        let duration = Double(destination.episode.duration)
        guard duration > 0 else { return [] }
        return episodesVM.trackGraph.tracks(forEpisode: destination.episode.id).compactMap { track in
            guard let ts = track.timestamp else { return nil }
            return Mark(order: track.order, at: min(1, max(0, Double(ts) / duration)))
        }
    }

    var body: some View {
        let position = LandingPosition(destination)
        let all = marks

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(position.phrase)
                    .font(.app(size: 12, weight: .medium))
                    .foregroundColor(.white.opacity(0.72))
                Spacer(minLength: 0)
                Text("\(all.count) tracks · \(destination.episode.formattedDuration)")
                    .font(.app(size: 11))
                    .monospacedDigit()
                    .foregroundColor(.white.opacity(0.4))
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.10))
                        .frame(height: 22)

                    ForEach(all) { mark in
                        let isDrop = mark.order == destination.track.order
                        Capsule()
                            .fill(isDrop ? Color.white : Color.white.opacity(0.3))
                            .frame(width: isDrop ? 3 : 1.5, height: isDrop ? 22 : 12)
                            .offset(
                                x: min(
                                    geo.size.width - (isDrop ? 3 : 1.5),
                                    max(0, geo.size.width * mark.at - (isDrop ? 1.5 : 0.75))
                                )
                            )
                    }
                }
                .frame(height: 22)
            }
            .frame(height: 22)
        }
    }
}

/// The set you came from, in the card layouts' shape. `HereRow` carries its own
/// horizontal padding for the row list, which would double up inside a card
/// stack that already pads itself — and a row among cards reads as a mistake
/// rather than a deliberately quieter thing.
struct HereCard: View {
    let appearance: TrackAppearance

    var body: some View {
        HStack(spacing: 12) {
            EpisodeArtwork(episode: appearance.episode)
                .frame(width: 44, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 7))
                .overlay(
                    RoundedRectangle(cornerRadius: 7)
                        .strokeBorder(.white.opacity(0.45), lineWidth: 1.5)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(appearance.episode.name)
                    .font(.app(size: 13, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                Text("YOU ARE HERE")
                    .font(.app(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(.white.opacity(0.55))
            }

            Spacer(minLength: 8)

            if let ts = appearance.track.formattedTimestamp {
                Text(ts)
                    .font(.app(size: 11, weight: .medium))
                    .monospacedDigit()
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Flatter than a destination: it's context, not somewhere to go.
        .background(
            RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.035))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
        )
    }
}
