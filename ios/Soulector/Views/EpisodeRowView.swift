import SwiftUI

struct EpisodeRowView: View {
    let episode: Episode
    let isPlaying: Bool
    let isFavorite: Bool
    let onTap: () -> Void
    let onFavorite: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Album art
                AsyncImage(url: URL(string: episode.artworkUrl)) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Rectangle().fill(Color.gray.opacity(0.3))
                    }
                }
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(
                    isPlaying ? playingOverlay : nil
                )

                // Text info
                VStack(alignment: .leading, spacing: 3) {
                    Text(episode.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        Text(episode.formattedDate)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.5))

                        Text("·")
                            .foregroundColor(.white.opacity(0.3))

                        Text(episode.formattedDuration)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.5))
                    }
                }

                Spacer()

                // Favorite button
                Button(action: {
                    UIImpactFeedbackGenerator(style: isFavorite ? .light : .medium).impactOccurred()
                    onFavorite()
                }) {
                    Image(systemName: isFavorite ? "heart.fill" : "heart")
                        .font(.system(size: 18))
                        .foregroundColor(isFavorite ? .red : .white.opacity(0.4))
                }
                .buttonStyle(.plain)
                .padding(.trailing, 4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(isPlaying ? Color.white.opacity(0.06) : Color.clear)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(action: {
                UIImpactFeedbackGenerator(style: isFavorite ? .light : .medium).impactOccurred()
                onFavorite()
            }) {
                Label(
                    isFavorite ? "Unfavorite" : "Favorite",
                    systemImage: isFavorite ? "heart.slash" : "heart"
                )
            }
            Button(action: onTap) {
                Label("Play", systemImage: "play.fill")
            }
            if let url = URL(string: episode.permalinkUrl) {
                Link(destination: url) {
                    Label("Open in SoundCloud", systemImage: "link")
                }
            }
        }
    }

    @ViewBuilder
    private var playingOverlay: some View {
        ZStack {
            Color.black.opacity(0.4)
            EqualizerBars()
        }
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

// MARK: - Playing indicator (equalizer bars)

/// Mirrors the web PlayingAnimation (src/client/components/Episode.tsx): three
/// bottom-anchored bars that oscillate while playing and freeze low when paused.
private struct EqualizerBars: View {
    @EnvironmentObject var playerStore: PlayerStore

    // Slightly different durations/phases per bar, matching the web timings.
    private let bars: [(duration: Double, delay: Double)] = [
        (0.50, 0.0),
        (0.42, 0.07),
        (0.58, 0.20),
    ]

    var body: some View {
        HStack(alignment: .bottom, spacing: 3) {
            ForEach(bars.indices, id: \.self) { i in
                EqualizerBar(
                    duration: bars[i].duration,
                    delay: bars[i].delay,
                    isPlaying: playerStore.isPlaying
                )
            }
        }
        .frame(height: 20)
    }
}

private struct EqualizerBar: View {
    let duration: Double
    let delay: Double
    let isPlaying: Bool

    private let minScale: CGFloat = 1.0 / 6.0
    @State private var scale: CGFloat = 1.0 / 6.0

    var body: some View {
        RoundedRectangle(cornerRadius: 1)
            .fill(Color.white)
            .frame(width: 3, height: 20)
            .scaleEffect(y: scale, anchor: .bottom)
            .onAppear { apply(playing: isPlaying) }
            .onChange(of: isPlaying) { apply(playing: $0) }
    }

    private func apply(playing: Bool) {
        if playing {
            scale = 1.0
            withAnimation(
                .easeInOut(duration: duration)
                    .repeatForever(autoreverses: true)
                    .delay(delay)
            ) {
                scale = minScale
            }
        } else {
            // Finite animation cancels the repeating one and settles low.
            withAnimation(.easeInOut(duration: 0.2)) {
                scale = minScale
            }
        }
    }
}
