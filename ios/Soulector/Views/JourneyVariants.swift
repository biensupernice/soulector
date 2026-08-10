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
                                    }

                                    // Sibling of the row's tap, not nested in
                                    // it — a button inside a button eats both.
                                    InPlaceTransitionControl(destination: other, tint: .white)
                                }
                                .padding(.horizontal, 20)
                                .padding(.vertical, 8)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
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
                        }
                    }
                    .padding(.leading, 36)
                    .padding(.trailing, 8)
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                // Sibling of the row's tap rather than inside it, so each keeps
                // its own gesture — the same rule the journey rows follow.
                .overlay(alignment: .trailing) {
                    InPlaceTransitionControl(destination: other, tint: textColor)
                        .padding(.trailing, 12)
                }
            }
        }
        .padding(.bottom, 6)
    }
}

// MARK: - Pager

/// The path laid sideways instead of stacked. Swiping right goes back the way
/// a stack does; swiping *left* goes forward again, which no navigation stack
/// offers — the step you backed out of is still there until you go somewhere
/// else.
struct JourneyPager: View {
    @Binding var path: [JourneyStep]
    let actions: JourneyActions

    /// Which step is on screen. Kept separate from `path` precisely so backing
    /// up doesn't discard the tail — that's the whole point of the variant.
    @State private var page = 0

    var body: some View {
        TabView(selection: $page) {
            ForEach(Array(path.enumerated()), id: \.offset) { index, step in
                Group {
                    switch step {
                    case .track(let appearance):
                        TrackEpisodesScreen(appearance: appearance, path: $path, actions: actions)
                    case .episode(let episode, let landedOn):
                        EpisodeTracksScreen(episode: episode, landedOn: landedOn, path: $path, actions: actions)
                    }
                }
                .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        // A new step arrives at the end; ride to it rather than staying put.
        .onChange(of: path.count) { count in
            withAnimation { page = max(0, count - 1) }
        }
        // There's no navigation bar out here to hang Done from — the pages
        // aren't in a stack — so the way out is drawn by the pager itself.
        .overlay(alignment: .topTrailing) {
            Button(action: actions.close) {
                Text("Done")
                    .font(.app(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.plain)
        }
        .overlay(alignment: .topLeading) {
            // How far along you are, and how much you could swipe back to.
            if path.count > 1 {
                Text("\(page + 1) / \(path.count)")
                    .font(.app(size: 12, weight: .semibold))
                    .monospacedDigit()
                    .foregroundColor(.white.opacity(0.6))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 13)
            }
        }
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
