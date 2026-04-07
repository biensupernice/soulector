import SwiftUI

struct MiniPlayerView: View {
    @EnvironmentObject var playerStore: PlayerStore
    let onTap: () -> Void

    var body: some View {
        if let episode = playerStore.currentEpisode {
            content(episode: episode)
        }
    }

    private func content(episode: Episode) -> some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Album art
                AsyncImage(url: URL(string: episode.artworkUrl)) { phase in
                    if case .success(let image) = phase {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        Color.gray.opacity(0.4)
                    }
                }
                .frame(width: 44, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 6))

                // Episode name + date
                VStack(alignment: .leading, spacing: 2) {
                    Text(episode.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Text(episode.formattedDate)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.5))
                        .lineLimit(1)
                }

                Spacer()

                // Loading indicator or controls
                if playerStore.isLoading {
                    ProgressView()
                        .tint(.white)
                        .frame(width: 36, height: 36)
                } else {
                    HStack(spacing: 4) {
                        // Skip forward 30s
                        Button(action: { playerStore.forward(30) }) {
                            Image(systemName: "goforward.30")
                                .font(.system(size: 20))
                                .foregroundColor(.white.opacity(0.85))
                                .frame(width: 36, height: 36)
                        }
                        .buttonStyle(.plain)

                        // Play / pause
                        Button(action: {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            playerStore.togglePlayPause()
                        }) {
                            Image(systemName: playerStore.isPlaying ? "pause.fill" : "play.fill")
                                .font(.system(size: 22))
                                .foregroundColor(.white)
                                .frame(width: 36, height: 36)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
            .background(Color.black.opacity(0.6))
            .overlay(
                // Accent-colored progress line at top
                GeometryReader { geo in
                    Rectangle()
                        .fill(playerStore.accentColor.opacity(0.9))
                        .frame(width: geo.size.width * playerStore.progress, height: 2)
                },
                alignment: .top
            )
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 20)
                .onEnded { value in
                    if value.translation.height < -20 {
                        onTap()
                    }
                }
        )
    }
}
