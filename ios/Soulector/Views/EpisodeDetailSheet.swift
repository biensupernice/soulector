import SwiftUI

struct EpisodeDetailSheet: View {
    let episode: Episode
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var favoritesStore: FavoritesStore
    @Environment(\.dismiss) var dismiss

    @State private var detailTracks: [EpisodeTrack] = []
    @State private var isLoadingDetailTracks = false
    @State private var episodeAccentColor: Color = .black

    private var tracks: [EpisodeTrack] { detailTracks }
    private var isLoadingTracks: Bool { isLoadingDetailTracks }
    private var isFavorite: Bool { favoritesStore.isFavorite(episode.id) }

    var body: some View {
        ZStack {
            // Accent color gradient background
            LinearGradient(
                colors: [episodeAccentColor.opacity(0.75), Color.black],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 0.5), value: episodeAccentColor)

            ScrollView {
                VStack(spacing: 20) {
                    // Drag handle
                    Capsule()
                        .fill(Color.white.opacity(0.3))
                        .frame(width: 40, height: 4)
                        .padding(.top, 12)

                    // Album art
                    AsyncImage(url: URL(string: episode.artworkUrl)) { phase in
                        if case .success(let image) = phase {
                            image.resizable().aspectRatio(contentMode: .fit)
                        } else {
                            Rectangle()
                                .fill(Color.gray.opacity(0.3))
                                .aspectRatio(1, contentMode: .fit)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 40)
                    .shadow(color: .black.opacity(0.5), radius: 20, y: 8)

                    // Title + date
                    VStack(spacing: 6) {
                        Text(episode.name)
                            .font(.title3.bold())
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 20)

                        Text("\(episode.collectiveName) · \(episode.formattedDate)")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.6))
                    }

                    // Player controls
                    PlayerControlsSection(episode: episode)

                    // Action buttons
                    HStack(spacing: 16) {
                        // Favorite
                        Button(action: {
                            UIImpactFeedbackGenerator(style: isFavorite ? .light : .medium).impactOccurred()
                            favoritesStore.toggleFavorite(episode.id)
                        }) {
                            HStack(spacing: 8) {
                                Image(systemName: isFavorite ? "heart.fill" : "heart")
                                Text(isFavorite ? "Unfavorite" : "Favorite")
                                    .font(.system(size: 14, weight: .medium))
                            }
                            .foregroundColor(isFavorite ? .red : .white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Color.white.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 20))
                        }

                        // SoundCloud link
                        if let url = URL(string: episode.permalinkUrl) {
                            Link(destination: url) {
                                HStack(spacing: 8) {
                                    Image(systemName: "link")
                                    Text("SoundCloud")
                                        .font(.system(size: 14, weight: .medium))
                                }
                                .foregroundColor(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(Color.white.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 20))
                            }
                        }
                    }

                    // Tracklist
                    if isLoadingTracks {
                        ProgressView()
                            .tint(.white)
                            .padding()
                    } else if !tracks.isEmpty {
                        TracklistView(tracks: tracks, playerStore: playerStore)
                    }

                    Spacer(minLength: 32)
                }
            }
        }
        .task(id: episode.id) {
            // Reuse already-loaded data if this is the current episode
            if playerStore.currentEpisode?.id == episode.id {
                if !playerStore.currentTracks.isEmpty {
                    detailTracks = playerStore.currentTracks
                }
                episodeAccentColor = playerStore.accentColor
            }

            // Always fetch accent color for the displayed episode
            if let accent = try? await APIClient.shared.fetchAccentColor(episodeId: episode.id) {
                episodeAccentColor = accent.swiftUIColor
            }

            // Fetch tracks if not already loaded
            if detailTracks.isEmpty {
                isLoadingDetailTracks = true
                detailTracks = (try? await APIClient.shared.fetchTracks(episodeId: episode.id)) ?? []
                isLoadingDetailTracks = false
            }
        }
    }
}

// MARK: - Player controls (embedded in sheet)

private struct PlayerControlsSection: View {
    let episode: Episode
    @EnvironmentObject var playerStore: PlayerStore

    @State private var rewindTrigger = 0
    @State private var forwardTrigger = 0

    private var isCurrentEpisode: Bool { playerStore.currentEpisode?.id == episode.id }

    var body: some View {
        VStack(spacing: 14) {
            // Progress (only shown when this episode is playing)
            if isCurrentEpisode {
                VStack(spacing: 4) {
                    ProgressSlider(
                        value: playerStore.progress,
                        onEditingChanged: { playerStore.isSeeking = $0 },
                        onSeek: { playerStore.seek(to: $0 * playerStore.duration) }
                    )
                    .padding(.horizontal, 24)

                    HStack {
                        Text(formatTime(playerStore.currentTime))
                        Spacer()
                        Text(formatTime(playerStore.duration))
                    }
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
                    .padding(.horizontal, 24)
                }
            }

            // Buttons
            HStack(spacing: 40) {
                if isCurrentEpisode {
                    Button(action: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        playerStore.rewind()
                    }) {
                        Image(systemName: "gobackward.15")
                            .font(.system(size: 26))
                            .foregroundColor(.white)
                    }
                }

                // Main play/pause
                Button(action: {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    if isCurrentEpisode {
                        playerStore.togglePlayPause()
                    } else {
                        Task { await playerStore.play(episode: episode) }
                    }
                }) {
                    ZStack {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 66, height: 66)

                        if isCurrentEpisode && playerStore.isLoading {
                            ProgressView().tint(.black).scaleEffect(1.2)
                        } else {
                            let icon = isCurrentEpisode && playerStore.isPlaying ? "pause.fill" : "play.fill"
                            Image(systemName: icon)
                                .font(.system(size: 26))
                                .foregroundColor(.black)
                                .offset(x: (isCurrentEpisode && playerStore.isPlaying) ? 0 : 2)
                        }
                    }
                }

                if isCurrentEpisode {
                    Button(action: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        playerStore.forward()
                    }) {
                        Image(systemName: "goforward.15")
                            .font(.system(size: 26))
                            .foregroundColor(.white)
                    }
                }
            }
        }
    }

    private func formatTime(_ seconds: Double) -> String {
        guard !seconds.isNaN, seconds >= 0 else { return "0:00" }
        let s = Int(seconds)
        let h = s / 3600; let m = (s % 3600) / 60; let sec = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%d:%02d", m, sec)
    }
}

// MARK: - Tracklist

struct TracklistView: View {
    let tracks: [EpisodeTrack]
    let playerStore: PlayerStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Tracklist")
                .font(.headline)
                .foregroundColor(.white.opacity(0.7))
                .padding(.horizontal, 20)
                .padding(.bottom, 12)

            ForEach(tracks) { track in
                TrackRow(track: track, playerStore: playerStore)
                Divider().background(Color.white.opacity(0.1)).padding(.horizontal, 20)
            }
        }
    }
}

private struct TrackRow: View {
    let track: EpisodeTrack
    let playerStore: PlayerStore

    var body: some View {
        Button(action: {
            if let ts = track.timestamp {
                playerStore.seek(to: Double(ts))
            }
        }) {
            HStack(alignment: .center, spacing: 12) {
                // Track number or timestamp
                if let ts = track.formattedTimestamp {
                    Text(ts)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.white.opacity(0.4))
                        .frame(width: 52, alignment: .leading)
                } else {
                    Text("\(track.order)")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.4))
                        .frame(width: 24, alignment: .center)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(track.name)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Text(track.artist)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.55))
                        .lineLimit(1)
                }

                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .disabled(track.timestamp == nil)
    }
}

// MARK: - Progress slider

struct ProgressSlider: View {
    let value: Double
    let onEditingChanged: (Bool) -> Void
    let onSeek: (Double) -> Void

    @GestureState private var isDragging = false
    @State private var dragValue: Double = 0

    var displayValue: Double { isDragging ? dragValue : value }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                // Track
                Capsule()
                    .fill(Color.white.opacity(0.2))
                    .frame(height: isDragging ? 6 : 4)

                // Fill
                Capsule()
                    .fill(Color.white)
                    .frame(width: max(0, geo.size.width * displayValue), height: isDragging ? 6 : 4)

                // Thumb
                Circle()
                    .fill(Color.white)
                    .frame(width: isDragging ? 18 : 0, height: isDragging ? 18 : 0)
                    .offset(x: max(0, geo.size.width * displayValue - (isDragging ? 9 : 0)))
            }
            .frame(height: 44)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .updating($isDragging) { _, state, _ in state = true }
                    .onChanged { gesture in
                        let pct = max(0, min(1, gesture.location.x / geo.size.width))
                        dragValue = pct
                        onEditingChanged(true)
                    }
                    .onEnded { gesture in
                        let pct = max(0, min(1, gesture.location.x / geo.size.width))
                        onSeek(pct)
                        onEditingChanged(false)
                    }
            )
        }
        .frame(height: 44)
        .animation(.easeInOut(duration: 0.1), value: isDragging)
    }
}
