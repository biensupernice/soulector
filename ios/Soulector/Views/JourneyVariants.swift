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

// MARK: - Track Episodes layouts [journey-variants]

/// Down a dated spine, oldest first. A list of destinations answers "where can
/// I go"; this answers "when did this record keep turning up", which is the
/// question the archive is actually interesting about. Years are called out
/// only when they change, so a record played three times in one season reads as
/// a cluster rather than three equal rows.
struct ChronologyList: View {
    let elsewhere: [TrackAppearance]
    /// The set you came from, placed in the run rather than listed apart — the
    /// record's homes include this one, and leaving it out makes a gap.
    let origin: TrackAppearance
    let onTap: (TrackAppearance) -> Void

    /// Everything the record touched, oldest first. An episode with no date
    /// sorts to the end rather than claiming a year it can't support.
    private var run: [TrackAppearance] {
        let undated = Date.distantFuture
        return (elsewhere + [origin]).sorted {
            ($0.episode.releasedAtDate ?? undated) < ($1.episode.releasedAtDate ?? undated)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(run.enumerated()), id: \.element.id) { index, stop in
                let year = stop.episode.releasedAtDate.map { Calendar.current.component(.year, from: $0) }
                let previous = index > 0
                    ? run[index - 1].episode.releasedAtDate.map { Calendar.current.component(.year, from: $0) }
                    : nil

                ChronologyStop(
                    appearance: stop,
                    year: year != previous ? year : nil,
                    isHere: stop.id == origin.id,
                    isFirst: index == 0,
                    isLast: index == run.count - 1,
                    onTap: { onTap(stop) }
                )
            }
        }
        .padding(.horizontal, 20)
    }
}

private struct ChronologyStop: View {
    let appearance: TrackAppearance
    let year: Int?
    let isHere: Bool
    let isFirst: Bool
    let isLast: Bool
    let onTap: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // The spine. Drawn per row rather than as one line behind the stack
            // so it can stop at the first and last stops instead of running off
            // into nothing.
            VStack(spacing: 0) {
                Rectangle()
                    .fill(Color.white.opacity(isFirst ? 0 : 0.18))
                    .frame(width: 1.5, height: 14)

                Circle()
                    .fill(isHere ? Color.white : Color.white.opacity(0.45))
                    .frame(width: isHere ? 9 : 6, height: isHere ? 9 : 6)

                Rectangle()
                    .fill(Color.white.opacity(isLast ? 0 : 0.18))
                    .frame(width: 1.5)
                    .frame(maxHeight: .infinity)
            }
            .frame(width: 10)

            VStack(alignment: .leading, spacing: 8) {
                if let year {
                    Text(String(year))
                        .font(.app(size: 13, weight: .bold))
                        .foregroundColor(.white.opacity(0.55))
                        .tracking(0.5)
                }

                Button { if !isHere { onTap() } } label: {
                    HStack(alignment: .center, spacing: 12) {
                        EpisodeArtwork(episode: appearance.episode)
                            .frame(width: 52, height: 52)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                        VStack(alignment: .leading, spacing: 3) {
                            Text(appearance.episode.name)
                                .font(.app(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)

                            HStack(spacing: 6) {
                                Text(appearance.episode.formattedDate)
                                if let ts = appearance.track.formattedTimestamp {
                                    Text("·")
                                    Text(ts).monospacedDigit()
                                }
                            }
                            .font(.app(size: 12))
                            .foregroundColor(.white.opacity(0.6))

                            if isHere {
                                Text("YOU ARE HERE")
                                    .font(.app(size: 9, weight: .bold))
                                    .tracking(1)
                                    .foregroundColor(.white.opacity(0.75))
                            }
                        }

                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)
                .padding(.bottom, 16)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Each set drawn as its own length with the record marked where it falls in
/// it. A record that always opens a set is a different record from one that
/// always closes one, and that fact is already in the data — a timestamp and a
/// duration — just never shown.
struct PositionsList: View {
    let elsewhere: [TrackAppearance]
    let onTap: (TrackAppearance) -> Void

    var body: some View {
        VStack(spacing: 14) {
            ForEach(elsewhere) { other in
                Button { onTap(other) } label: {
                    PositionRow(appearance: other)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20)
    }
}

private struct PositionRow: View {
    let appearance: TrackAppearance

    /// Where the record sits in the set, 0 to 1. Nil when the cue sheet has no
    /// timestamp for it, in which case the bar is left off rather than guessed.
    private var fraction: Double? {
        guard let ts = appearance.track.timestamp, appearance.episode.duration > 0 else { return nil }
        return min(1, max(0, Double(ts) / Double(appearance.episode.duration)))
    }

    /// The same thing in words, because a mark two thirds along a bar is a
    /// picture and "near the close" is the point of it.
    private var phrase: String {
        guard let fraction else { return "somewhere in the set" }
        switch fraction {
        case ..<0.12:  return "opens the set"
        case ..<0.38:  return "early on"
        case ..<0.68:  return "deep in it"
        case ..<0.88:  return "late in the set"
        default:       return "near the close"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                EpisodeArtwork(episode: appearance.episode)
                    .frame(width: 44, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: 7))

                VStack(alignment: .leading, spacing: 2) {
                    Text(appearance.episode.name)
                        .font(.app(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(phrase)
                        .font(.app(size: 12))
                        .foregroundColor(.white.opacity(0.62))
                }

                Spacer(minLength: 0)

                if let ts = appearance.track.formattedTimestamp {
                    Text(ts)
                        .font(.app(size: 12))
                        .monospacedDigit()
                        .foregroundColor(.white.opacity(0.75))
                }
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.14))
                        .frame(height: 4)

                    if let fraction {
                        Capsule()
                            .fill(Color.white.opacity(0.32))
                            .frame(width: geo.size.width * fraction, height: 4)

                        // The mark itself, held inside the bar at both ends so
                        // an opener doesn't render as a chip hanging off the
                        // left edge.
                        Capsule()
                            .fill(Color.white)
                            .frame(width: 3, height: 12)
                            .offset(x: min(geo.size.width - 3, max(0, geo.size.width * fraction - 1.5)))
                    }
                }
                .frame(height: 12)
            }
            .frame(height: 12)

            Text(appearance.episode.formattedDuration)
                .font(.app(size: 10))
                .monospacedDigit()
                .foregroundColor(.white.opacity(0.4))
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06))
        )
    }
}

/// One band per set, painted in that set's own album accent. The journey
/// already fetches these colours to tint its chrome one screen at a time; shown
/// side by side they turn a list of names into a list of *places*, which is the
/// thing artwork does on the shelf and type never does in rows.
struct BandsList: View {
    let elsewhere: [TrackAppearance]
    @ObservedObject var accents: JourneyAccents
    let onTap: (TrackAppearance) -> Void

    var body: some View {
        VStack(spacing: 10) {
            ForEach(elsewhere) { other in
                Button { onTap(other) } label: {
                    BandRow(appearance: other, accent: accents.accent(for: other.episode.id))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20)
    }
}

private struct BandRow: View {
    let appearance: TrackAppearance
    let accent: AccentColor?

    /// Until the colour arrives the band sits in the same neutral the rest of
    /// the journey uses, so it fades in rather than flashing from grey to hue.
    private var fill: Color { accent?.raw ?? Color(white: 0.16) }
    private var ink: Color { (accent?.prefersDarkText ?? false) ? .black : .white }

    var body: some View {
        HStack(spacing: 14) {
            EpisodeArtwork(episode: appearance.episode)
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text(appearance.episode.name)
                    .font(.app(size: 15, weight: .bold))
                    .foregroundColor(ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 6) {
                    Text(appearance.episode.formattedDate)
                    if let ts = appearance.track.formattedTimestamp {
                        Text("·")
                        Text("drops at \(ts)").monospacedDigit()
                    }
                }
                .font(.app(size: 12))
                .foregroundColor(ink.opacity(0.75))
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(ink.opacity(0.5))
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(fill))
        .animation(.easeOut(duration: 0.35), value: accent?.raw)
    }
}

/// A destination in the hero layout's rail: artwork, number, landing time.
struct HeroChip: View {
    let appearance: TrackAppearance
    let isHere: Bool
    let onTap: () -> Void

    var body: some View {
        Button { if !isHere { onTap() } } label: {
            VStack(alignment: .leading, spacing: 6) {
                EpisodeArtwork(episode: appearance.episode)
                    .frame(width: 96, height: 96)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay {
                        if isHere {
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(.white, lineWidth: 2)
                        }
                    }

                Text(isHere ? "you are here" : (appearance.track.formattedTimestamp ?? "—"))
                    .font(.app(size: 11, weight: isHere ? .semibold : .regular))
                    .monospacedDigit()
                    .foregroundColor(.white.opacity(isHere ? 0.9 : 0.6))
            }
            .frame(width: 96)
        }
        .buttonStyle(.plain)
    }
}
