import SwiftUI

/// Mirrors the web's mobile episode sheet
/// (src/client/EpisodesScreen/EpisodeModalSheet): a solid accent-colored
/// sheet with a subtle top-to-bottom gray overlay, white content, outlined
/// action buttons, and the tracklist in a translucent dark panel.
struct EpisodeDetailSheet: View {
    let episode: Episode
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var favoritesStore: FavoritesStore
    @Environment(\.dismiss) var dismiss

    @State private var detailTracks: [EpisodeTrack] = []
    @State private var isLoadingDetailTracks = false
    @State private var episodeAccent: AccentColor?
    @State private var showAccentChip = false
    @State private var accentChipGeneration = 0
    @AppStorage(TextOnAccent.storageKey) private var textOnAccentRaw = TextOnAccent.white.rawValue

    private var tracks: [EpisodeTrack] { detailTracks }
    private var isLoadingTracks: Bool { isLoadingDetailTracks }
    private var isFavorite: Bool { favoritesStore.isFavorite(episode.id) }

    /// This episode's accent with the app-wide swatch override applied.
    private var sheetAccent: AccentColor? {
        episodeAccent?.withSwatch(named: playerStore.accentSwatchOverride)
    }
    /// Web paints the sheet container with the raw accent (`bg-accent`).
    private var accentBackground: Color { sheetAccent?.raw ?? Color(white: 0.09) }
    /// Text color over the accent background (the text-on-accent variant).
    private var fg: Color {
        (TextOnAccent(rawValue: textOnAccentRaw) ?? .white).color(over: sheetAccent)
    }

    var body: some View {
        ZStack {
            accentBackground.ignoresSafeArea()
            // Darker take on the web's overlay (gray-700/30 → white/5): the
            // accent hue shows through, but deepened enough that the sheet
            // still reads as part of a dark-mode app.
            LinearGradient(
                colors: [
                    Color.black.opacity(0.25),
                    Color.black.opacity(0.55),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Drag handle
                    Capsule()
                        .fill(fg.opacity(0.3))
                        .frame(width: 40, height: 4)
                        .padding(.top, 12)

                    // Album art. Long-press cycles through the extraction's
                    // palette swatches (debug affordance, applies app-wide).
                    AsyncImage(url: URL(string: episode.artworkUrl)) { phase in
                        if case .success(let image) = phase {
                            image.resizable().aspectRatio(contentMode: .fit)
                        } else {
                            Rectangle()
                                .fill(Color.gray.opacity(0.3))
                                .aspectRatio(1, contentMode: .fit)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .padding(.horizontal, 40)
                    .onLongPressGesture {
                        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                        playerStore.cycleAccentSwatch()
                    }

                    if showAccentChip {
                        AccentSwatchChip(label: playerStore.accentSwatchLabel)
                            .transition(.opacity)
                    }

                    // Title + date (web: bold white title, white/80 date)
                    VStack(spacing: 4) {
                        Text(episode.name)
                            .font(.app(size: 17, weight: .bold))
                            .foregroundColor(fg)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 20)

                        Text(episode.formattedDate)
                            .font(.app(size: 14))
                            .foregroundColor(fg.opacity(0.8))
                    }

                    // Player controls
                    PlayerControlsSection(episode: episode, accent: accentBackground, textColor: fg)

                    // Action buttons (web: 2-col grid of white-outlined buttons)
                    HStack(spacing: 8) {
                        if let url = URL(string: episode.permalinkUrl) {
                            Link(destination: url) {
                                actionButtonLabel(icon: "link", text: "Open in SoundCloud")
                            }
                        }

                        Button(action: {
                            UIImpactFeedbackGenerator(style: isFavorite ? .light : .medium).impactOccurred()
                            favoritesStore.toggleFavorite(episode.id)
                        }) {
                            actionButtonLabel(
                                icon: isFavorite ? "heart.fill" : "heart",
                                text: isFavorite ? "Remove Favorite" : "Add Favorite"
                            )
                        }
                    }
                    .padding(.horizontal, 16)

                    // Tracklist in a translucent panel (web: bg-black/20)
                    if isLoadingTracks {
                        ProgressView()
                            .tint(fg)
                            .padding()
                    } else if !tracks.isEmpty {
                        TracklistView(tracks: tracks, episode: episode, accent: accentBackground, textColor: fg)
                            .background(Color.black.opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .padding(.horizontal, 12)
                    }

                    Spacer(minLength: 32)
                }
            }
        }
        .animation(.easeInOut(duration: 0.5), value: sheetAccent)
        .task(id: episode.id) {
            // Reuse already-loaded data if this is the current episode
            if playerStore.currentEpisode?.id == episode.id {
                if !playerStore.currentTracks.isEmpty {
                    detailTracks = playerStore.currentTracks
                }
                episodeAccent = playerStore.accent
            }

            // Always fetch accent color for the displayed episode
            if let accent = try? await APIClient.shared.fetchAccentColor(episodeId: episode.id) {
                episodeAccent = accent
            }

            // Fetch tracks if not already loaded
            if detailTracks.isEmpty {
                isLoadingDetailTracks = true
                detailTracks = (try? await APIClient.shared.fetchTracks(episodeId: episode.id)) ?? []
                isLoadingDetailTracks = false
            }
        }
        .onChange(of: playerStore.accentSwatchOverride) { _ in
            flashAccentChip()
        }
    }

    private func actionButtonLabel(icon: String, text: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
            Text(text)
                .font(.app(size: 12, weight: .semibold))
        }
        .foregroundColor(fg)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(fg, lineWidth: 2))
    }

    private func flashAccentChip() {
        accentChipGeneration += 1
        let generation = accentChipGeneration
        withAnimation(.easeInOut(duration: 0.15)) { showAccentChip = true }
        Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            guard generation == accentChipGeneration else { return }
            withAnimation(.easeInOut(duration: 0.3)) { showAccentChip = false }
        }
    }
}

/// Transient label naming the active accent swatch while cycling.
struct AccentSwatchChip: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.app(size: 12, weight: .semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.black.opacity(0.45))
            .clipShape(Capsule())
    }
}

// MARK: - Player controls (embedded in sheet)

private struct PlayerControlsSection: View {
    let episode: Episode
    /// The sheet's accent — the web colors the play glyph with it
    /// (`text-accent` on the white circle).
    let accent: Color
    /// Text/glyph color over the accent background.
    let textColor: Color
    @EnvironmentObject var playerStore: PlayerStore

    @State private var scrubTime: Double? = nil

    private var isCurrentEpisode: Bool { playerStore.currentEpisode?.id == episode.id }

    var body: some View {
        VStack(spacing: 14) {
            // Progress (only shown when this episode is playing)
            if isCurrentEpisode {
                VStack(spacing: 4) {
                    ProgressSlider(
                        value: playerStore.progress,
                        onEditingChanged: { if $0 { playerStore.isSeeking = true } },
                        onScrub: { scrubTime = $0 * playerStore.duration },
                        onSeek: { pct in
                            scrubTime = nil
                            playerStore.seek(to: pct * playerStore.duration)
                        }
                    )
                    .padding(.horizontal, 24)

                    HStack {
                        Text(formatTime(scrubTime ?? playerStore.currentTime))
                        Spacer()
                        Text(formatTime(playerStore.duration))
                    }
                    .font(.app(size: 12))
                    .foregroundColor(textColor)
                    .padding(.horizontal, 24)
                }
            }

            // Buttons (web: big white 30s skips around a white circle whose
            // play/pause glyph is accent-colored)
            HStack(spacing: 24) {
                if isCurrentEpisode {
                    Button(action: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        playerStore.rewind(30)
                    }) {
                        Image(systemName: "gobackward.30")
                            .font(.system(size: 30))
                            .foregroundColor(textColor)
                    }
                }

                // Main play/pause
                Button(action: {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    if isCurrentEpisode {
                        playerStore.togglePlayPause()
                    } else {
                        Task { await playerStore.play(episode: episode) }
                    }
                }) {
                    ZStack {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 72, height: 72)

                        if isCurrentEpisode && playerStore.isLoading {
                            ProgressView().tint(accent).scaleEffect(1.2)
                        } else {
                            let icon = isCurrentEpisode && playerStore.isPlaying ? "pause.fill" : "play.fill"
                            Image(systemName: icon)
                                .font(.system(size: 28))
                                .foregroundColor(accent)
                                .offset(x: (isCurrentEpisode && playerStore.isPlaying) ? 0 : 2)
                        }
                    }
                }

                if isCurrentEpisode {
                    Button(action: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        playerStore.forward(30)
                    }) {
                        Image(systemName: "goforward.30")
                            .font(.system(size: 30))
                            .foregroundColor(textColor)
                    }
                }
            }
        }
    }

    private func formatTime(_ seconds: Double) -> String {
        guard !seconds.isNaN, seconds >= 0 else { return "0:00" }
        let s = Int(seconds)
        let h = s / 3600; let m = (s % 3600) / 60; let sec = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%d:%02d", m, sec)
    }
}

// MARK: - Tracklist

struct TracklistView: View {
    let tracks: [EpisodeTrack]
    let episode: Episode
    /// Accent for the current track's number inside its badge (web:
    /// `bg-white text-accent`).
    let accent: Color
    /// Text color over the accent background.
    let textColor: Color
    @EnvironmentObject var playerStore: PlayerStore

    private var currentTrack: EpisodeTrack? {
        guard playerStore.currentEpisode?.id == episode.id else { return nil }
        let t = playerStore.currentTime
        return tracks.filter { track in
            guard let ts = track.timestamp else { return false }
            return t >= Double(ts)
        }.last
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(tracks.count) Tracks")
                .font(.app(size: 18, weight: .bold))
                .foregroundColor(textColor)
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 12)

            ForEach(tracks) { track in
                let isCurrent = currentTrack?.id == track.id
                TrackRow(track: track, episode: episode, accent: accent, textColor: textColor, isCurrent: isCurrent)
            }
            .padding(.bottom, 4)
        }
        .padding(.bottom, 8)
    }
}

private struct PingRing: View {
    let color: Color
    @State private var pinging = false

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 20, height: 20)
            .scaleEffect(pinging ? 2.0 : 1.0)
            .opacity(pinging ? 0 : 0.5)
            // Scoped so the repeatForever can't leak into surrounding layout
            // transactions (see MarqueeText.restart).
            .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false), value: pinging)
            .onAppear { pinging = true }
    }
}

private struct TrackRow: View {
    let track: EpisodeTrack
    let episode: Episode
    let accent: Color
    let textColor: Color
    let isCurrent: Bool
    @EnvironmentObject var playerStore: PlayerStore

    var body: some View {
        Button(action: {
            guard let ts = track.timestamp else { return }
            if playerStore.currentEpisode?.id == episode.id {
                playerStore.seek(to: Double(ts))
            } else {
                Task { await playerStore.play(episode: episode, startingAt: Double(ts)) }
            }
        }) {
            ZStack(alignment: .leading) {
                // Left current-track bar
                Rectangle()
                    .fill(textColor)
                    .frame(width: 2)
                    .opacity(isCurrent ? 1 : 0)
                    .animation(.easeInOut(duration: 0.3), value: isCurrent)

                HStack(alignment: .center, spacing: 12) {
                    // Track number; the current one sits in a white badge with
                    // an accent-colored number and a ping ring (web parity)
                    ZStack {
                        if isCurrent {
                            PingRing(color: textColor)
                            Circle()
                                .fill(textColor)
                                .frame(width: 20, height: 20)
                            Text("\(track.order)")
                                .font(.app(size: 10, weight: .bold))
                                .foregroundColor(accent)
                        } else {
                            Text("\(track.order)")
                                .font(.app(size: 12))
                                .foregroundColor(textColor)
                        }
                    }
                    .frame(width: 24)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(track.name)
                            .font(.app(size: 14, weight: isCurrent ? .bold : .medium))
                            .foregroundColor(textColor)
                            .lineLimit(1)
                        Text(track.artist)
                            .font(.app(size: 13))
                            .foregroundColor(textColor.opacity(isCurrent ? 1.0 : 0.8))
                            .lineLimit(1)
                    }
                    .animation(.easeInOut(duration: 0.3), value: isCurrent)

                    Spacer()

                    if let ts = track.formattedTimestamp {
                        Text(ts)
                            .font(.app(size: 12))
                            .foregroundColor(textColor)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
        }
        .buttonStyle(.plain)
        .disabled(track.timestamp == nil)
    }
}

// MARK: - Progress slider

struct ProgressSlider: View {
    let value: Double
    let onEditingChanged: (Bool) -> Void
    let onScrub: (Double) -> Void
    let onSeek: (Double) -> Void

    @State private var isDragging = false
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
                    .onChanged { gesture in
                        let pct = max(0, min(1, gesture.location.x / geo.size.width))
                        isDragging = true
                        dragValue = pct
                        onEditingChanged(true)
                        onScrub(pct)
                    }
                    .onEnded { gesture in
                        let pct = max(0, min(1, gesture.location.x / geo.size.width))
                        dragValue = pct
                        onSeek(pct)
                        onEditingChanged(false)
                        isDragging = false
                    }
            )
        }
        .frame(height: 44)
        .animation(.easeInOut(duration: 0.1), value: isDragging)
    }
}
