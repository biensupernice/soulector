import SwiftUI

// MARK: - The journey in flight

/// One journey: the route walked so far, and the step waiting to be pushed once
/// the episode sheet is out of the way. Held here rather than in a screen's
/// `@State` because the Mini Player can raise the sheet *over* a running
/// journey, and a journey that lived in the screen would be stranded by that.
@MainActor
final class JourneyCoordinator: ObservableObject {
    /// The pushed route.
    @Published var path: [JourneyStep] = []
    /// A journey that can't start until the episode sheet is out of the way.
    /// Dismissing and pushing in the same turn drops the push, so the tapped
    /// track parks here and the root picks it up on dismissal.
    @Published var pending: TrackAppearance?

    var isActive: Bool { !path.isEmpty }

    /// Opens a journey on the tapped track — or continues the one already
    /// running, which is the usual case.
    func open(_ appearance: TrackAppearance) {
        Diagnostics.breadcrumb("journey open · \(appearance.episode.name) / \(appearance.track.name)")

        // A journey already in flight continues rather than starting over. This
        // is reached from the episode sheet, which the Mini Player can raise
        // over a running journey — so the tapped track is usually a record in a
        // set the route already passed through, and replacing the path threw
        // the whole route away.
        //
        // Truncating to that set and pushing keeps the rail honest: you went
        // back to it and moved sideways from there, which is what the taps
        // actually were. A set that isn't on the route at all has nothing to
        // continue, so it opens a new journey.
        if let index = path.lastIndex(where: { $0.episode.id == appearance.episode.id }) {
            path = Array(path.prefix(index + 1)) + [.track(appearance)]
        } else {
            path = [.track(appearance)]
        }
    }

    /// A transition landed. The point of arranging one was to end up over
    /// there, so leave the user looking at that episode's tracks, at the record
    /// that carried them.
    ///
    /// The route records it because arranging a transition *is* the
    /// navigation — you chose that set and the moment you'd arrive in it, and
    /// the wait is the only thing between the choice and the arrival.
    func landed(_ transition: QueuedTransition) {
        Diagnostics.breadcrumb("landed · \(transition.episode.name) · push Episode Tracks")
        path.append(.episode(transition.episode, landedOn: transition.track.order))
    }

    /// Where a queued transition was arranged from: the record playing now, and
    /// everywhere else it turns up — which is the screen that shows the pending
    /// one sitting armed in the list. Returned rather than opened, because the
    /// episode sheet has to close before the journey can go anywhere.
    func sourceAppearance(playing: PlayerStore) -> TrackAppearance? {
        guard let episode = playing.currentEpisode else { return nil }
        let now = playing.currentTime
        let record = playing.currentTracks.playing(at: now)
        guard let record else { return nil }
        Diagnostics.breadcrumb("on deck tapped · source \(record.name)")
        return TrackAppearance(episode: episode, track: record)
    }

    func end() {
        Diagnostics.breadcrumb("journey end · depth \(path.count)")
        path = []
        pending = nil
    }
}

// MARK: - A destination

/// A set that also played this record, as a card big enough to answer "what am
/// I walking into" — which is the question that turned out to matter. Arriving
/// somewhere is easier to choose than going somewhere.
struct DestinationCard: View {
    let destination: TrackAppearance
    /// The transition already arranged for this destination, if it's on deck.
    let armed: QueuedTransition?
    let canQueue: Bool
    let onTap: () -> Void
    let onQueue: (TransitionAudio) -> Void
    let onCallOff: () -> Void

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

            RunwayPanel(destination: destination)

            TransitionChoices(
                armed: armed?.audio,
                canQueue: canQueue,
                onPick: onQueue,
                onCallOff: onCallOff
            )
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.07)))
        // The outline is how an armed card marks itself. Anything drawn inside
        // the card competed with its own content, and a fill that tracked the
        // countdown showed nothing at all in the moment just after arming.
        .overlay(
            RoundedRectangle(cornerRadius: 16).strokeBorder(
                armed != nil ? Color.white.opacity(0.85) : Color.white.opacity(0.10),
                lineWidth: armed != nil ? 2 : 1
            )
        )
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: armed?.id)
    }
}
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

/// The set you came from, marked. Flatter than a destination card: it's context
/// for where you're standing, not somewhere to go, and it carries no horizontal
/// padding of its own because the card stack around it already pads.
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
