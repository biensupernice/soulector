import SwiftUI

// MARK: - Sideways affordance

/// The way sideways: how many other sets played this track, and the tap that
/// opens them. Sized to sit at the end of a tracklist row without competing
/// with the row's own tap.
struct TrackBranchButton: View {
    let count: Int
    var tint: Color = .white
    let action: () -> Void

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

// MARK: - Dive

/// One step of a dive. A dive alternates between the two: a track shows the
/// sets that played it, a set shows the tracks you can leave by.
private enum DiveStep: Hashable {
    case track(TrackAppearance)
    case episode(Episode)
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

/// Moving *sideways*: from a track in the set you're listening to, out to the
/// other sets that played the same record, into one of them, and on again from
/// its tracklist. The navigation stack is the dive — every step is a push, so
/// back retraces the path you took through the library.
///
/// Everything here reads from `EpisodesViewModel.trackGraph`, which is built
/// from the on-device search index: no request stands between a tap and the
/// next set.
struct TrackDiveSheet: View {
    /// The track the dive starts from, and the episode it was playing in.
    let origin: TrackAppearance
    var onLanded: (Episode) -> Void = { _ in }

    @State private var path: [DiveStep] = []
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack(path: $path) {
            DiveTrackScreen(appearance: origin, path: $path, actions: actions)
                .navigationDestination(for: DiveStep.self) { step in
                    switch step {
                    case .track(let appearance):
                        DiveTrackScreen(appearance: appearance, path: $path, actions: actions)
                    case .episode(let episode):
                        DiveEpisodeScreen(episode: episode, path: $path, actions: actions)
                    }
                }
        }
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

    private var others: [TrackAppearance] {
        episodesVM.trackGraph.otherAppearances(
            of: appearance.track,
            excluding: appearance.episode.id
        )
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
        .diveChrome(title: appearance.track.name, close: actions.close)
    }

    private func header(count: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(appearance.track.name)
                .font(.app(size: 22, weight: .bold))
                .foregroundColor(.white)
                .fixedSize(horizontal: false, vertical: true)

            Text(appearance.track.artist)
                .font(.app(size: 15))
                .foregroundColor(.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)

            if count > 0 {
                Text("ALSO PLAYED IN \(count) OTHER \(count == 1 ? "EPISODE" : "EPISODES")")
                    .font(.app(size: 11, weight: .semibold))
                    .tracking(1)
                    .foregroundColor(.white.opacity(0.4))
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
                .foregroundColor(.white.opacity(0.3))
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
            .foregroundColor(.white.opacity(0.5))
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
        path.append(.episode(other.episode))
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
                        .font(.app(size: 14, weight: .semibold))
                        .foregroundColor(isCurrent ? playerStore.accentOnDark : .white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        Text(appearance.episode.formattedDate)
                            .font(.app(size: 12))
                            .foregroundColor(.white.opacity(0.5))

                        Text("·")
                            .foregroundColor(.white.opacity(0.3))

                        Text(appearance.episode.collectiveName)
                            .font(.app(size: 12))
                            .foregroundColor(.white.opacity(0.5))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)

                if let timestamp = appearance.track.formattedTimestamp {
                    Text(timestamp)
                        .font(.app(size: 11, weight: .medium))
                        .foregroundColor(.white.opacity(0.7))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.white.opacity(0.1)))
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
    @Binding var path: [DiveStep]
    let actions: DiveActions

    @EnvironmentObject var episodesVM: EpisodesViewModel
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var radioStore: RadioStore

    @State private var fetchedTracks: [EpisodeTrack] = []
    @State private var isLoadingTracks = false

    private var isCurrent: Bool { playerStore.currentEpisode?.id == episode.id }

    /// The index already carries this set's cue sheet; the fetch below is only
    /// for the rare episode the snapshot has no tracks for.
    private var tracks: [EpisodeTrack] {
        let indexed = episodesVM.trackGraph.tracks(forEpisode: episode.id)
        if !indexed.isEmpty { return indexed }
        if isCurrent, !playerStore.currentTracks.isEmpty { return playerStore.currentTracks }
        return fetchedTracks
    }

    /// The track playing right now, when this is the set that's playing.
    private var currentTrack: EpisodeTrack? {
        guard isCurrent else { return nil }
        let elapsed = playerStore.currentTime
        return tracks.filter { track in
            guard let timestamp = track.timestamp else { return false }
            return elapsed >= Double(timestamp)
        }.last
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header

                if tracks.isEmpty {
                    tracklistPlaceholder
                } else {
                    ForEach(tracks) { track in
                        DiveTrackRow(
                            track: track,
                            isCurrent: currentTrack?.id == track.id,
                            connections: episodesVM.trackGraph.connectionCount(
                                of: track,
                                excluding: episode.id
                            ),
                            onPlay: { play(track) },
                            onDive: { path.append(.track(TrackAppearance(episode: episode, track: track))) }
                        )
                    }
                }

                Color.clear.frame(height: 24)
            }
        }
        .diveChrome(title: episode.name, close: actions.close)
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
                    .foregroundColor(.white.opacity(0.5))

                Spacer(minLength: 6)

                Button(action: playFromStart) {
                    HStack(spacing: 5) {
                        Image(systemName: playIcon)
                            .font(.system(size: 11, weight: .semibold))
                        Text(playLabel)
                            .font(.app(size: 12, weight: .semibold))
                    }
                    .foregroundColor(.black)
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
                    .foregroundColor(.white.opacity(0.5))
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

/// A track in the dive's tracklist: tap the row to hear it here, tap the branch
/// to see who else played it.
private struct DiveTrackRow: View {
    let track: EpisodeTrack
    let isCurrent: Bool
    let connections: Int
    let onPlay: () -> Void
    let onDive: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            HStack(alignment: .center, spacing: 12) {
                Text("\(track.order)")
                    .font(.app(size: 12, weight: isCurrent ? .bold : .regular))
                    .foregroundColor(isCurrent ? .white : .white.opacity(0.4))
                    .frame(width: 22, alignment: .trailing)

                VStack(alignment: .leading, spacing: 2) {
                    Text(track.name)
                        .font(.app(size: 14, weight: isCurrent ? .bold : .medium))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Text(track.artist)
                        .font(.app(size: 12))
                        .foregroundColor(.white.opacity(isCurrent ? 0.8 : 0.5))
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                if let timestamp = track.formattedTimestamp {
                    Text(timestamp)
                        .font(.app(size: 11))
                        .foregroundColor(.white.opacity(0.4))
                }
            }
            .padding(.leading, 20)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
            .onTapGesture { onPlay() }

            if connections > 0 {
                TrackBranchButton(count: connections, action: onDive)
            }
        }
        .padding(.trailing, 16)
        .background(isCurrent ? Color.white.opacity(0.06) : Color.clear)
    }
}

// MARK: - Chrome

/// Every dive screen looks the same: black, an inline title that doubles as the
/// back button's label one step later, and a way out of the whole dive.
private struct DiveChrome: ViewModifier {
    let title: String
    let close: () -> Void

    func body(content: Content) -> some View {
        content
            .background(Color.black.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(Color.black, for: .navigationBar)
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

private extension View {
    func diveChrome(title: String, close: @escaping () -> Void) -> some View {
        modifier(DiveChrome(title: title, close: close))
    }
}
