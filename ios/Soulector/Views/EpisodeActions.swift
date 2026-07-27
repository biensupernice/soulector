import SwiftUI

// MARK: - Kebab button

/// The tap-sized entry point to `EpisodeActionsSheet`. Same glyph in the list
/// and in the episode sheet, so "more things I can do here" is one shape to
/// learn. Presentation lives with the caller — a sheet attached to a scrolling
/// row gets dismissed when that row recycles.
struct EpisodeKebabButton: View {
    var tint: Color = .white.opacity(0.4)
    var size: CGSize = CGSize(width: 36, height: 44)
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "ellipsis")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(tint)
                .frame(width: size.width, height: size.height)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
/// so a queued download never looks stalled. Shared with the actions sheet.
struct DownloadRing: View {
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
