import SwiftUI

struct EpisodeRowView: View {
    let episode: Episode
    let isPlaying: Bool
    let onTap: () -> Void
    /// Presenting from the row itself would tie the sheet's lifetime to a cell
    /// that scrolls away, so the screen owns it.
    let onShowActions: () -> Void

    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var favoritesStore: FavoritesStore
    @EnvironmentObject var downloadsStore: DownloadsStore
    @EnvironmentObject var network: NetworkMonitor

    private var downloadState: DownloadState {
        downloadsStore.state(for: episode.id)
    }

    private var isFavorite: Bool { favoritesStore.isFavorite(episode.id) }

    /// With no network an episode we haven't downloaded simply can't play, so
    /// the row says as much up front instead of failing after the tap.
    private var unavailable: Bool {
        !network.isOnline && downloadState != .downloaded
    }

    var body: some View {
        // The tap target and the trailing controls are siblings rather than
        // controls nested inside the row button, so each gets its own taps.
        HStack(spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: 12) {
                    EpisodeArtwork(episode: episode)
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(
                            isPlaying ? playingOverlay : nil
                        )

                    // Text info
                    VStack(alignment: .leading, spacing: 3) {
                        Text(episode.name)
                            .font(.app(size: 14, weight: .semibold))
                            // Playing row title picks up the album accent, like
                            // the web list (on-dark variant for the black bg).
                            .foregroundColor(isPlaying ? playerStore.accentOnDark : .white)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        HStack(spacing: 6) {
                            Text(episode.formattedDate)
                                .font(.app(size: 12))
                                .foregroundColor(.white.opacity(0.5))

                            Text("·")
                                .foregroundColor(.white.opacity(0.3))

                            Text(episode.formattedDuration)
                                .font(.app(size: 12))
                                .foregroundColor(.white.opacity(0.5))

                            // Favoriting moved into the actions sheet, but you
                            // still need to see it while browsing — so it reads
                            // as a mark here rather than a control.
                            if isFavorite {
                                Text("·")
                                    .foregroundColor(.white.opacity(0.3))

                                Image(systemName: "heart.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(Color(red: 1, green: 0.35, blue: 0.36).opacity(0.9))
                                    .accessibilityLabel("Favorite")
                            }

                            if downloadState != .notDownloaded {
                                Text("·")
                                    .foregroundColor(.white.opacity(0.3))

                                DownloadBadge(state: downloadState, size: 11)
                            }
                        }
                    }

                    Spacer(minLength: 8)
                }
                .padding(.leading, 16)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(unavailable)

            EpisodeKebabButton(action: onShowActions)
                .padding(.trailing, 4)
        }
        .opacity(unavailable ? 0.4 : 1)
        .background(isPlaying ? Color.white.opacity(0.06) : Color.clear)
        .contextMenu {
            EpisodeActions(
                episode: episode,
                favoritesStore: favoritesStore,
                downloadsStore: downloadsStore,
                onPlay: unavailable ? nil : onTap,
                canDownload: network.isOnline
            )
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
    @State private var generation = 0

    var body: some View {
        RoundedRectangle(cornerRadius: 1)
            .fill(Color.white)
            .frame(width: 3, height: 20)
            .scaleEffect(y: scale, anchor: .bottom)
            .onAppear { apply(playing: isPlaying) }
            .onChange(of: isPlaying) { apply(playing: $0) }
    }

    private func apply(playing: Bool) {
        generation += 1
        if playing {
            scale = 1.0
            let started = generation
            // Deferred a tick so the repeatForever gets its own transaction —
            // started inside an in-flight layout transaction (this overlay
            // appears together with the mini player slide-in) it would leak
            // onto every view animating in it. See MarqueeText.restart.
            DispatchQueue.main.async {
                guard started == generation else { return }
                withAnimation(
                    .easeInOut(duration: duration)
                        .repeatForever(autoreverses: true)
                        .delay(delay)
                ) {
                    scale = minScale
                }
            }
        } else {
            // Finite animation cancels the repeating one and settles low.
            withAnimation(.easeInOut(duration: 0.2)) {
                scale = minScale
            }
        }
    }
}
