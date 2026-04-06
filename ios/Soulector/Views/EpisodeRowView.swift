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
            if #available(iOS 17.0, *) {
                Image(systemName: "waveform")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
                    .symbolEffect(.variableColor.iterative, options: .repeating)
            } else {
                Image(systemName: "waveform")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
