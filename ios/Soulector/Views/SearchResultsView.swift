import SwiftUI

/// Track-aware search results: each episode row (reusing `EpisodeRowView`)
/// followed by its matching tracks in an indented block connected by a vertical
/// line, mirroring the web app's SearchResults.
struct SearchResultsView: View {
    let results: [EpisodeSearchResult]
    /// True while the index is still loading and there is nothing to show yet.
    let loading: Bool
    let currentEpisodeId: String?
    let bottomPadding: CGFloat
    let isFavorite: (String) -> Bool
    let onEpisodeTap: (Episode) -> Void
    let onTrackTap: (Episode, Int?) -> Void
    let onFavorite: (Episode) -> Void

    var body: some View {
        if results.isEmpty {
            emptyState
        } else {
            List {
                ForEach(results) { result in
                    VStack(alignment: .leading, spacing: 0) {
                        EpisodeRowView(
                            episode: result.episode,
                            isPlaying: currentEpisodeId == result.episode.id,
                            isFavorite: isFavorite(result.episode.id),
                            onTap: { onEpisodeTap(result.episode) },
                            onFavorite: { onFavorite(result.episode) }
                        )
                        if !result.matchedTracks.isEmpty {
                            matchedTracks(for: result)
                        }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
                Color.clear
                    .frame(height: bottomPadding)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets())
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
    }

    // The connector sits under the center of the 56pt artwork (16pt row inset +
    // 28pt) so it reads as descending from the episode.
    private func matchedTracks(for result: EpisodeSearchResult) -> some View {
        HStack(alignment: .top, spacing: 0) {
            Rectangle()
                .fill(Color.white.opacity(0.2))
                .frame(width: 2)
                .padding(.leading, 44)

            VStack(spacing: 0) {
                ForEach(result.matchedTracks) { track in
                    Button(action: { onTrackTap(result.episode, track.timestamp) }) {
                        HStack(spacing: 8) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(track.name)
                                    .font(.app(size: 14, weight: .semibold))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                Text(track.artist)
                                    .font(.app(size: 12))
                                    .foregroundColor(.white.opacity(0.5))
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 0)
                            if let ts = track.formattedTimestamp {
                                Text(ts)
                                    .font(.app(size: 11, weight: .medium))
                                    .foregroundColor(.white.opacity(0.7))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.white.opacity(0.1))
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.vertical, 8)
                        .padding(.leading, 14)
                        .padding(.trailing, 16)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.bottom, 4)
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Spacer()
            if loading {
                Text("Loading library…")
                    .font(.app(size: 14))
                    .foregroundColor(.white.opacity(0.5))
            } else {
                Image(systemName: "music.note")
                    .font(.system(size: 32))
                    .foregroundColor(.white.opacity(0.3))
                    .padding(.bottom, 4)
                Text("No matches found")
                    .font(.app(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                Text("Try a different track, artist, or episode name.")
                    .font(.app(size: 13))
                    .foregroundColor(.white.opacity(0.5))
                    .multilineTextAlignment(.center)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
    }
}
