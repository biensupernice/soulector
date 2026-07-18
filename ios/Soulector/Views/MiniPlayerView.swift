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
                    MarqueeText(text: episode.name)
                        .foregroundColor(.white)
                    Text(episode.formattedDate)
                        .font(.app(size: 12))
                        .foregroundColor(.white.opacity(0.5))
                        .lineLimit(1)
                }

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

// MARK: - Marquee text

/// Auto-scrolls the text when it overflows the available width, mirroring the
/// web MarqueeText (src/client/EpisodesScreen/Player/MiniPlayerControls.tsx):
/// two copies separated by `gap` scroll left at `speed` pt/s and loop
/// seamlessly. Falls back to plain truncated text when it fits.
private struct MarqueeText: View {
    let text: String
    var font: Font = .app(size: 14, weight: .semibold)
    var gap: CGFloat = 40
    var speed: CGFloat = 30 // points per second

    @State private var textWidth: CGFloat = 0
    @State private var containerWidth: CGFloat = 0
    @State private var offset: CGFloat = 0
    @State private var generation = 0

    private var shouldMarquee: Bool { containerWidth > 0 && textWidth > containerWidth }

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .clipped()
            .background(
                // Measure the available container width.
                GeometryReader { proxy in
                    Color.clear
                        .onAppear { containerWidth = proxy.size.width }
                        .onChange(of: proxy.size.width) { containerWidth = $0 }
                }
            )
            .overlay(
                // Off-layout copy that reports the text's natural width.
                Text(text)
                    .font(font)
                    .fixedSize()
                    .background(
                        GeometryReader { proxy in
                            Color.clear
                                .onAppear { textWidth = proxy.size.width }
                                .onChange(of: proxy.size.width) { textWidth = $0 }
                        }
                    )
                    .hidden()
                    .frame(width: 0, height: 0),
                alignment: .leading
            )
            .onChange(of: text) { _ in restart() }
            .onChange(of: textWidth) { _ in restart() }
            .onChange(of: containerWidth) { _ in restart() }
    }

    @ViewBuilder
    private var content: some View {
        if shouldMarquee {
            HStack(spacing: gap) {
                Text(text).font(font).fixedSize()
                Text(text).font(font).fixedSize()
            }
            .offset(x: offset)
        } else {
            Text(text)
                .font(font)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    private func restart() {
        // Cancel any running loop and reset before (re)starting.
        var noAnim = Transaction()
        noAnim.disablesAnimations = true
        withTransaction(noAnim) { offset = 0 }

        generation += 1
        guard shouldMarquee, textWidth > 0 else { return }
        let distance = textWidth + gap
        let started = generation
        // Deferred a tick: restart() fires during layout (width measurement,
        // the mini player's slide-in), and a repeatForever started inside an
        // in-flight transaction leaks onto every view animating in it —
        // sending the whole screen sliding by the marquee distance forever.
        DispatchQueue.main.async {
            guard started == generation else { return }
            withAnimation(.linear(duration: Double(distance / speed)).repeatForever(autoreverses: false)) {
                offset = -distance
            }
        }
    }
}
