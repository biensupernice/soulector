import SwiftUI

// MARK: - Menu contents

/// Everything you can do to an episode without playing it. Shared by the kebab
/// button and the row's long-press menu so the two can't drift apart.
///
/// Stores are handed in rather than read from the environment: this renders
/// inside `.contextMenu`, which hosts its content outside the view tree.
struct EpisodeActions: View {
    let episode: Episode
    @ObservedObject var favoritesStore: FavoritesStore
    @ObservedObject var downloadsStore: DownloadsStore
    /// Omitted where a play control is already on screen (the episode sheet).
    var onPlay: (() -> Void)? = nil
    /// Starting a download needs a network; offline the action is left out
    /// rather than offered and immediately failed.
    var canDownload: Bool = true

    private var isFavorite: Bool { favoritesStore.isFavorite(episode.id) }

    var body: some View {
        Group {
            downloadAction

            Button {
                UIImpactFeedbackGenerator(style: isFavorite ? .light : .medium).impactOccurred()
                favoritesStore.toggleFavorite(episode.id)
            } label: {
                Label(
                    isFavorite ? "Unfavorite" : "Favorite",
                    systemImage: isFavorite ? "heart.slash" : "heart"
                )
            }

            if let onPlay {
                Button(action: onPlay) {
                    Label("Play", systemImage: "play.fill")
                }
            }

            if let url = URL(string: episode.permalinkUrl) {
                Link(destination: url) {
                    Label("Open in SoundCloud", systemImage: "link")
                }
            }
        }
    }

    @ViewBuilder
    private var downloadAction: some View {
        switch downloadsStore.state(for: episode.id) {
        case .notDownloaded:
            downloadButton(title: "Download")
        case .failed:
            downloadButton(title: "Try Download Again")
        case .waiting, .downloading:
            Button {
                downloadsStore.remove(episode.id)
            } label: {
                Label("Cancel Download", systemImage: "xmark.circle")
            }
        case .downloaded:
            Button(role: .destructive) {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                downloadsStore.remove(episode.id)
            } label: {
                Label("Remove Download", systemImage: "trash")
            }
        }
    }

    /// Nothing to offer for episodes the API can't hand us audio for
    /// (MIXCLOUD without an archive mirror).
    @ViewBuilder
    private func downloadButton(title: String) -> some View {
        if episode.isStreamable && canDownload {
            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                downloadsStore.download(episode)
            } label: {
                Label(title, systemImage: "arrow.down.circle")
            }
        }
    }
}

// MARK: - Kebab button

/// The tap-sized entry point to `EpisodeActions`. Same glyph in the list and in
/// the episode sheet, so "more things I can do here" is one shape to learn.
struct EpisodeKebabButton: View {
    let episode: Episode
    var onPlay: (() -> Void)? = nil
    var tint: Color = .white.opacity(0.4)
    var size: CGSize = CGSize(width: 36, height: 44)

    @EnvironmentObject var favoritesStore: FavoritesStore
    @EnvironmentObject var downloadsStore: DownloadsStore
    @EnvironmentObject var network: NetworkMonitor

    var body: some View {
        Menu {
            EpisodeActions(
                episode: episode,
                favoritesStore: favoritesStore,
                downloadsStore: downloadsStore,
                onPlay: onPlay,
                canDownload: network.isOnline
            )
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(tint)
                .frame(width: size.width, height: size.height)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("More actions")
    }
}

// MARK: - Status badge

/// A quiet marker for an episode's offline copy: a ring while it lands, a small
/// filled arrow once it's on the device. It rides along in the metadata line
/// rather than claiming a column of its own.
struct DownloadBadge: View {
    let state: DownloadState
    var tint: Color = .white.opacity(0.5)
    var size: CGFloat = 12

    var body: some View {
        switch state {
        case .notDownloaded:
            EmptyView()
        case .waiting:
            DownloadRing(progress: nil, tint: tint, size: size)
        case .downloading(let progress):
            DownloadRing(progress: progress, tint: tint, size: size)
        case .downloaded:
            Image(systemName: "arrow.down.circle.fill")
                .font(.system(size: size))
                .foregroundColor(tint)
                .accessibilityLabel("Downloaded")
        case .failed:
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: size))
                .foregroundColor(Color.orange.opacity(0.9))
                .accessibilityLabel("Download failed")
        }
    }
}

/// Determinate once the transfer reports bytes; before that a short arc spins,
/// so a queued download never looks stalled.
private struct DownloadRing: View {
    let progress: Double?
    let tint: Color
    let size: CGFloat

    @State private var spinning = false

    private var isIndeterminate: Bool { progress == nil }
    /// A sliver of arc from the start, so 0% still reads as "working".
    private var trimEnd: Double { progress.map { max(0.06, min(1, $0)) } ?? 0.25 }
    private var rotation: Double { -90 + (isIndeterminate && spinning ? 360 : 0) }

    var body: some View {
        ZStack {
            Circle()
                .stroke(tint.opacity(0.25), lineWidth: 1.5)
            Circle()
                .trim(from: 0, to: trimEnd)
                .stroke(tint, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                .rotationEffect(.degrees(rotation))
                // Both animations stay scoped to this shape: a repeatForever
                // started with `withAnimation` would leak into whatever layout
                // transaction is in flight (see MarqueeText.restart).
                .animation(
                    isIndeterminate
                        ? .linear(duration: 0.9).repeatForever(autoreverses: false)
                        : .easeOut(duration: 0.25),
                    value: rotation
                )
                .animation(.easeOut(duration: 0.25), value: trimEnd)
        }
        .frame(width: size, height: size)
        .onAppear { spinning = true }
        .accessibilityLabel("Downloading")
    }
}
