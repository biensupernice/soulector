import SwiftUI

/// Where the kebab leads. A compact panel for one episode, painted in that
/// episode's own album accent so it reads as part of the record rather than a
/// generic system menu — and it stays open while a download runs, so tapping
/// Download shows you the ring start filling instead of dropping you back to
/// the list on faith.
struct EpisodeActionsSheet: View {
    let episode: Episode

    @EnvironmentObject var favoritesStore: FavoritesStore
    @EnvironmentObject var downloadsStore: DownloadsStore
    @EnvironmentObject var network: NetworkMonitor
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var accent: AccentColor?
    @State private var favoritePulse = 0
    /// Seeded generously so the first layout doesn't animate up from nothing.
    @State private var contentHeight: CGFloat = 300

    private var isFavorite: Bool { favoritesStore.isFavorite(episode.id) }
    private var downloadState: DownloadState { downloadsStore.state(for: episode.id) }
    /// Same treatment as the episode sheet: the raw accent under a darkening
    /// gradient, so the hue comes through but white text stays readable.
    private var accentBackground: Color { accent?.appSwatch.raw ?? Color(white: 0.12) }

    var body: some View {
        ZStack(alignment: .top) {
            accentBackground.ignoresSafeArea()
            LinearGradient(
                colors: [Color.black.opacity(0.25), Color.black.opacity(0.55)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Capsule()
                    .fill(Color.white.opacity(0.3))
                    .frame(width: 40, height: 4)
                    .padding(.top, 10)
                    .padding(.bottom, 16)

                header

                Divider()
                    .overlay(Color.white.opacity(0.15))
                    .padding(.horizontal, 20)

                actions
            }
            // The sheet sizes itself to its rows rather than sitting at a
            // half-screen detent with dead space under three items.
            .background(
                GeometryReader { proxy in
                    Color.clear
                        .onAppear { contentHeight = proxy.size.height }
                        .onChange(of: proxy.size.height) { contentHeight = $0 }
                }
            )
        }
        .animation(.easeInOut(duration: 0.4), value: accent)
        .presentationDetents([.height(contentHeight)])
        .presentationDragIndicator(.hidden)
        .task(id: episode.id) {
            if let cached = downloadsStore.cachedMetadata(for: episode.id)?.accent {
                accent = cached
            }
            if let fetched = try? await APIClient.shared.fetchAccentColor(episodeId: episode.id) {
                accent = fetched
            }
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 14) {
            EpisodeArtwork(episode: episode)
                .frame(width: 54, height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 3) {
                Text(episode.name)
                    .font(.app(size: 15, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                Text("\(episode.formattedDate) · \(episode.formattedDuration)")
                    .font(.app(size: 12))
                    .foregroundColor(.white.opacity(0.7))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 16)
    }

    // MARK: Actions

    private var actions: some View {
        VStack(spacing: 0) {
            downloadRow

            ActionRow(
                icon: .symbol(isFavorite ? "heart.fill" : "heart"),
                title: isFavorite ? "Remove from Favorites" : "Add to Favorites",
                iconTint: isFavorite ? Color(red: 1, green: 0.35, blue: 0.36) : .white,
                pulse: favoritePulse
            ) {
                UIImpactFeedbackGenerator(style: isFavorite ? .light : .medium).impactOccurred()
                favoritesStore.toggleFavorite(episode.id)
                favoritePulse += 1
            }

            if let url = URL(string: episode.permalinkUrl) {
                ActionRow(icon: .symbol("link"), title: "Open in SoundCloud") {
                    dismiss()
                    openURL(url)
                }
            }
        }
        .padding(.top, 6)
        .padding(.bottom, 24)
    }

    @ViewBuilder
    private var downloadRow: some View {
        switch downloadState {
        case .notDownloaded:
            if canDownload {
                ActionRow(
                    icon: .symbol("arrow.down"),
                    title: "Download",
                    subtitle: "Save for offline listening"
                ) { startDownload() }
            }
        case .failed:
            if canDownload {
                ActionRow(
                    icon: .symbol("arrow.clockwise"),
                    title: "Try Download Again",
                    subtitle: "The last attempt didn't finish"
                ) { startDownload() }
            }
        case .waiting:
            ActionRow(
                icon: .ring(nil),
                title: "Preparing download…",
                subtitle: "Tap to cancel"
            ) { downloadsStore.remove(episode.id) }
        case .downloading(let progress):
            ActionRow(
                icon: .ring(progress),
                title: "Downloading \(Int(progress * 100))%",
                subtitle: "Tap to cancel"
            ) { downloadsStore.remove(episode.id) }
        case .downloaded:
            ActionRow(
                icon: .symbol("trash"),
                title: "Remove Download",
                subtitle: downloadedSubtitle,
                isDestructive: true
            ) {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                downloadsStore.remove(episode.id)
            }
        }
    }

    /// Starting a transfer needs a network, and MIXCLOUD episodes without an
    /// archive mirror have no audio to fetch.
    private var canDownload: Bool { episode.isStreamable && network.isOnline }

    private var downloadedSubtitle: String {
        guard let size = downloadsStore.formattedSize(for: episode.id) else { return "On this device" }
        return "\(size) on this device"
    }

    private func startDownload() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        downloadsStore.download(episode)
    }
}

// MARK: - Action row

private enum ActionIcon {
    case symbol(String)
    /// nil progress spins; a value fills.
    case ring(Double?)
}

private struct ActionRow: View {
    let icon: ActionIcon
    let title: String
    var subtitle: String? = nil
    var iconTint: Color = .white
    var isDestructive: Bool = false
    /// Bump to make the icon pop — the acknowledgement for an action that
    /// changes state in place instead of dismissing the sheet.
    var pulse: Int = 0
    let action: () -> Void

    @State private var iconScale: CGFloat = 1

    private var titleColor: Color {
        isDestructive ? Color(red: 1, green: 0.45, blue: 0.42) : .white
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.white.opacity(0.12))
                        .frame(width: 38, height: 38)

                    switch icon {
                    case .symbol(let name):
                        Image(systemName: name)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(isDestructive ? titleColor : iconTint)
                    case .ring(let progress):
                        DownloadRing(progress: progress, tint: .white, size: 18)
                    }
                }
                .scaleEffect(iconScale)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.app(size: 15, weight: .semibold))
                        .foregroundColor(titleColor)

                    if let subtitle {
                        Text(subtitle)
                            .font(.app(size: 12))
                            .foregroundColor(.white.opacity(0.6))
                    }
                }
                .multilineTextAlignment(.leading)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .frame(height: 60)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(ActionRowStyle())
        .onChange(of: pulse) { _ in pop() }
    }

    private func pop() {
        withAnimation(.spring(response: 0.2, dampingFraction: 0.45)) { iconScale = 1.28 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.6)) { iconScale = 1 }
        }
    }
}

private struct ActionRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color.white.opacity(0.1) : Color.clear)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
