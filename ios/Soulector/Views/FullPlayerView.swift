import SwiftUI

struct FullPlayerView: View {
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var favoritesStore: FavoritesStore
    @Environment(\.dismiss) var dismiss

    var body: some View {
        if let episode = playerStore.currentEpisode {
            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Drag indicator
                    Capsule()
                        .fill(Color.white.opacity(0.3))
                        .frame(width: 40, height: 4)
                        .padding(.top, 12)
                        .padding(.bottom, 24)

                    ScrollView {
                        VStack(spacing: 24) {
                            // Album art
                            AsyncImage(url: URL(string: episode.artworkUrl)) { phase in
                                if case .success(let image) = phase {
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fit)
                                } else {
                                    Rectangle()
                                        .fill(Color.gray.opacity(0.3))
                                        .aspectRatio(1, contentMode: .fit)
                                }
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .padding(.horizontal, 32)
                            .shadow(color: .black.opacity(0.4), radius: 20, y: 10)

                            // Episode info
                            VStack(spacing: 6) {
                                Text(episode.name)
                                    .font(.title3.bold())
                                    .foregroundColor(.white)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 24)

                                Text("\(episode.collectiveName) · \(episode.formattedDate)")
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.6))
                            }

                            // Progress
                            VStack(spacing: 6) {
                                ProgressSlider(
                                    value: playerStore.progress,
                                    onEditingChanged: { editing in
                                        playerStore.isSeeking = editing
                                    },
                                    onSeek: { pct in
                                        playerStore.seek(to: pct * playerStore.duration)
                                    }
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

                            // Controls
                            HStack(spacing: 44) {
                                Button(action: { playerStore.rewind() }) {
                                    Image(systemName: "gobackward.15")
                                        .font(.system(size: 28))
                                        .foregroundColor(.white)
                                }

                                Button(action: { playerStore.togglePlayPause() }) {
                                    ZStack {
                                        Circle()
                                            .fill(Color.white)
                                            .frame(width: 72, height: 72)
                                        if playerStore.isLoading {
                                            ProgressView()
                                                .tint(.black)
                                                .scaleEffect(1.2)
                                        } else {
                                            Image(systemName: playerStore.isPlaying ? "pause.fill" : "play.fill")
                                                .font(.system(size: 30))
                                                .foregroundColor(.black)
                                                .offset(x: playerStore.isPlaying ? 0 : 2)
                                        }
                                    }
                                }

                                Button(action: { playerStore.forward() }) {
                                    Image(systemName: "goforward.15")
                                        .font(.system(size: 28))
                                        .foregroundColor(.white)
                                }
                            }
                            .padding(.vertical, 8)

                            // Bottom row: favorite + SoundCloud link
                            HStack(spacing: 32) {
                                Button(action: { favoritesStore.toggleFavorite(episode.id) }) {
                                    Image(systemName: favoritesStore.isFavorite(episode.id) ? "heart.fill" : "heart")
                                        .font(.system(size: 24))
                                        .foregroundColor(favoritesStore.isFavorite(episode.id) ? .red : .white.opacity(0.6))
                                }

                                if let url = URL(string: episode.permalinkUrl) {
                                    Link(destination: url) {
                                        HStack(spacing: 6) {
                                            Image(systemName: "link")
                                            Text("SoundCloud")
                                                .font(.system(size: 14, weight: .medium))
                                        }
                                        .foregroundColor(.white.opacity(0.7))
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 20)
                                                .stroke(Color.white.opacity(0.3), lineWidth: 1)
                                        )
                                    }
                                }
                            }
                            .padding(.bottom, 32)
                        }
                    }
                }
            }
        }
    }

    private func formatTime(_ seconds: Double) -> String {
        guard !seconds.isNaN, seconds >= 0 else { return "0:00" }
        let s = Int(seconds)
        let h = s / 3600
        let m = (s % 3600) / 60
        let sec = s % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, sec)
        }
        return String(format: "%d:%02d", m, sec)
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
