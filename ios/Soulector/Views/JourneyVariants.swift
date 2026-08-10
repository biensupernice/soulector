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
