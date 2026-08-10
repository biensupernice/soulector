import SwiftUI

/// Shared horizontal inset for every top-level element in the episode sheet
/// (album art, title/date, player controls, action buttons, tracklist) so they
/// all line up on the same left/right margin.
private let sheetHPadding: CGFloat = 20

/// Mirrors the web's mobile episode sheet
/// (src/client/EpisodesScreen/EpisodeModalSheet): a solid accent-colored
/// sheet with a subtle top-to-bottom gray overlay, white content, outlined
/// action buttons, and the tracklist in a translucent dark panel.
struct EpisodeDetailSheet: View {
    let episode: Episode
    /// Called with the episode a sideways journey left playing, so the screen that
    /// owns this sheet can point it at where the user ended up. Without it the
    /// sheet would sit here describing the set they left.
    var onNavigate: ((Episode) -> Void)?

    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var favoritesStore: FavoritesStore
    @EnvironmentObject var downloadsStore: DownloadsStore
    @EnvironmentObject var episodesVM: EpisodesViewModel
    @EnvironmentObject var journey: JourneyCoordinator
    @Environment(\.journeyNavigation) private var journeyNavigation
    @Environment(\.dismiss) var dismiss
    @Environment(\.verticalSizeClass) private var verticalSizeClass

    @State private var detailTracks: [EpisodeTrack] = []
    @State private var isLoadingDetailTracks = false
    @State private var episodeAccent: AccentColor?
    /// Which episode `detailTracks`/`episodeAccent` were loaded for.
    @State private var loadedEpisodeId: String?
    @State private var showActions = false
    /// Where a journey ended up, applied once it's fully dismissed — swapping
    /// this sheet's episode out from under a presented child would be a fight.
    @State private var journeyLanded: Episode?
    // [journey-variants] the journey screens read their accents from the
    // environment, and pushing them here means this host has to supply them —
    // TrackJourneySheet did it for the modal variants and nobody did it here.
    @StateObject private var journeyAccents = JourneyAccents()
    private var tracks: [EpisodeTrack] { detailTracks }
    private var isLoadingTracks: Bool { isLoadingDetailTracks }
    private var isFavorite: Bool { favoritesStore.isFavorite(episode.id) }

    /// This episode's accent resolved to the app's chosen swatch (Vibrant).
    private var sheetAccent: AccentColor? { episodeAccent?.appSwatch }
    /// Web paints the sheet container with the raw accent (`bg-accent`).
    private var accentBackground: Color { sheetAccent?.raw ?? Color(white: 0.09) }
    /// Text color over the accent background.
    private var fg: Color { .white }

    /// A short screen (iPhone in landscape) can't stack art over controls over
    /// tracklist without everything being squeezed off-screen, so that case gets
    /// a docked layout instead: art and transport parked in a fixed left column,
    /// the tracklist scrolling beside them.
    private var isDocked: Bool { verticalSizeClass == .compact }

    var body: some View {
        // The ZStack is what lets the outgoing set stay on screen while the
        // incoming one arrives; keyed on the episode, the contents are replaced
        // in place and the sheet itself never goes anywhere — which is what
        // stopped a landing transition reading as a close and a reopen.
        // [journey-variants] pushInSheet hosts the journey here. The stack must
        // sit outside the .id() below: that boundary rebuilds the content on
        // every handover, and a stack inside it would lose the whole path.
        journeyStackIfNeeded {
        ZStack {
            content
                .id(episode.id)
                // The crossfade: the set being left dissolves into the one
                // arriving. Slow enough to read as a handover rather than a
                // glitch, still enough not to fight the journey's landing focus,
                // which is scrolling the new tracklist at the same moment.
                .transition(.opacity)
        }
        .animation(.easeInOut(duration: 0.55), value: episode.id)
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: playerStore.queued?.id)
        // A transition that lands while this sheet is up retargets it at the set
        // that's now playing, whether or not the journey is still open over it.
        .onReceive(playerStore.transitionsFired) { transition in
            guard transition.episode.id != episode.id else { return }
            // [journey-variants] the pushed variants navigate to the landing
            // instead; retargeting as well would move two things at once.
            guard !journeyNavigation.hasPushedPath else { return }
            onNavigate?(transition.episode)
        }
        }
    }

    // [journey-variants] ------------------------------------------------------
    @ViewBuilder
    private func journeyStackIfNeeded<Content: View>(@ViewBuilder _ inner: () -> Content) -> some View {
        if journeyNavigation == .pushInSheet {
            NavigationStack(path: $journey.path) {
                inner()
                    .toolbar(.hidden, for: .navigationBar)
                    .journeyDestinations(path: $journey.path, actions: journeyActions)
            }
            .environmentObject(journeyAccents)
            // A drag down would otherwise throw away the whole journey from
            // three pushes deep; with a path, Done is the way out.
            .interactiveDismissDisabled(!journey.path.isEmpty)
        } else {
            inner()
        }
    }

    private var journeyActions: JourneyActions {
        JourneyActions(
            onLanded: { onNavigate?($0) },
            close: { journey.end() }
        )
    }
    // [journey-variants] ------------------------------------------------------

    private var content: some View {
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

            Group {
                if isDocked {
                    dockedLayout
                } else {
                    stackedLayout
                }
            }
            // Attached to the layout rather than alongside the actions sheet
            // below: two `.sheet` modifiers on one view fight over the
            // presentation.
            .sheet(item: $journey.origin, onDismiss: {
                if let landed = journeyLanded, landed.id != episode.id { onNavigate?(landed) }
                journeyLanded = nil
                // [journey-variants] the route is shared state now, so closing
                // the container it was drawn in has to put it away.
                journey.path = []
            }) { origin in
                // [journey-variants] peek answers from a short sheet instead
                if journeyNavigation == .peek {
                    PeekConnections(
                        appearance: origin,
                        accent: accentBackground,
                        onPick: { journeyLanded = $0 }
                    )
                    .presentationDetents([.height(300), .large])
                    .presentationDragIndicator(.visible)
                } else {
                    // Hand the journey this episode's accent so its first screen —
                    // the track's other homes — opens already wearing the colour of
                    // the set it was launched from.
                    TrackJourneySheet(
                        origin: origin,
                        seedAccent: episodeAccent,
                        onLanded: { journeyLanded = $0 }
                    )
                }
            }
        }
        // Fixed top bar: dismiss and "more" balanced on either side of the drag
        // handle, so the corners answer each other instead of one lonely kebab.
        // It stays put while the content scrolls under it.
        .overlay(alignment: .top) { topBar }
        .sheet(isPresented: $showActions) {
            EpisodeActionsSheet(episode: episode)
        }
        .animation(.easeInOut(duration: 0.5), value: sheetAccent)
        .task(id: episode.id) {
            // A journey can retarget this sheet at a different episode without the
            // view being torn down, so anything loaded for the last one has to
            // go before the guards below decide there's nothing left to fetch.
            if loadedEpisodeId != episode.id {
                loadedEpisodeId = episode.id
                detailTracks = []
                episodeAccent = nil
            }

            // Reuse already-loaded data if this is the current episode
            if playerStore.currentEpisode?.id == episode.id {
                if !playerStore.currentTracks.isEmpty {
                    detailTracks = playerStore.currentTracks
                }
                episodeAccent = playerStore.accent
            }

            // A downloaded episode carries its own tracklist and accent, so the
            // sheet fills in with no network — and instantly with one.
            if let offline = downloadsStore.cachedMetadata(for: episode.id) {
                if detailTracks.isEmpty { detailTracks = offline.tracks }
                if episodeAccent == nil { episodeAccent = offline.accent }
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
    }

    // MARK: - Layouts

    /// Portrait: one column, everything scrolls together.
    private var stackedLayout: some View {
        ScrollView {
            VStack(spacing: 20) {
                EpisodeArtwork(episode: episode, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, sheetHPadding)
                    // Clears the fixed top bar, with the same breathing room
                    // the drag handle used to leave.
                    .padding(.top, 52)

                titleBlock(titleSize: 17, dateSize: 14)
                    .padding(.horizontal, sheetHPadding)

                onDeckPanel
                    .padding(.horizontal, sheetHPadding)

                PlayerControlsSection(episode: episode, accent: accentBackground, textColor: fg)

                actionButtons
                    .padding(.horizontal, sheetHPadding)

                if isLoadingTracks {
                    ProgressView()
                        .tint(fg)
                        .padding()
                } else if !tracks.isEmpty {
                    tracklistPanel
                        .padding(.horizontal, sheetHPadding)
                }

                Spacer(minLength: 32)
            }
        }
    }

    /// Landscape: the player docks into a fixed left column — art, title,
    /// transport — while what's on deck, the actions and the tracklist scroll on
    /// the right. Nothing you need mid-listen (scrubber, skips, play) ever
    /// scrolls away, and a journey is still one tap from any row.
    private var dockedLayout: some View {
        GeometryReader { geo in
            // The art takes whatever height is left once the dock's text and
            // transport are accounted for, and never more than a share of the
            // width — so it stays square and the right column keeps its room.
            let artSide = min(max(geo.size.height - 216, 96), geo.size.width * 0.36)
            let dockWidth = max(artSide, 208)

            HStack(alignment: .top, spacing: 20) {
                VStack(spacing: 10) {
                    EpisodeArtwork(episode: episode, contentMode: .fill)
                        .frame(width: artSide, height: artSide)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .shadow(color: .black.opacity(0.35), radius: 14, y: 6)

                    titleBlock(titleSize: 14, dateSize: 12)
                        .lineLimit(2)

                    Spacer(minLength: 0)

                    PlayerControlsSection(
                        episode: episode,
                        accent: accentBackground,
                        textColor: fg,
                        compact: true,
                        horizontalPadding: 0
                    )
                }
                .frame(width: dockWidth)

                ScrollView {
                    VStack(spacing: 14) {
                        onDeckPanel

                        actionButtons

                        if isLoadingTracks {
                            ProgressView()
                                .tint(fg)
                                .padding(.top, 24)
                        } else if !tracks.isEmpty {
                            tracklistPanel
                        }
                    }
                    .padding(.bottom, 16)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, sheetHPadding)
            // Clears the (shorter) docked top bar.
            .padding(.top, 38)
            .padding(.bottom, 10)
        }
    }

    // MARK: - Shared pieces

    /// Title + date (web: bold white title, white/80 date).
    private func titleBlock(titleSize: CGFloat, dateSize: CGFloat) -> some View {
        VStack(spacing: 4) {
            Text(episode.name)
                .font(.app(size: titleSize, weight: .bold))
                .foregroundColor(fg)
                .multilineTextAlignment(.center)

            HStack(spacing: 6) {
                Text(episode.formattedDate)
                    .font(.app(size: dateSize))
                    .foregroundColor(fg.opacity(0.8))

                if downloadState != .notDownloaded {
                    Text("·")
                        .font(.app(size: dateSize))
                        .foregroundColor(fg.opacity(0.5))

                    DownloadBadge(state: downloadState, tint: fg.opacity(0.8), size: 12)
                }
            }
        }
    }

    /// What's on deck, when this is the set it's transition from. Same news the
    /// mini player carries, with room here to say where it's going.
    @ViewBuilder
    private var onDeckPanel: some View {
        if playerStore.currentEpisode?.id == episode.id,
           let queued = playerStore.queued {
            OnDeckPanel(
                queued: queued,
                remaining: playerStore.queuedRemaining ?? 0,
                isTransitioning: playerStore.isTransitioning,
                accent: accentBackground,
                // Tapping what's on deck goes to where it was arranged: the
                // record playing now, and everywhere else it turns up — which
                // is the list this one is sitting armed in.
                onShowSource: {
                    guard let source = journey.sourceAppearance(playing: playerStore) else { return }
                    // Same handoff the connections tap makes: full screen can't
                    // push until this sheet is out of the way.
                    if journeyNavigation.leavesTheSheet {
                        journey.pending = source
                        dismiss()
                    } else {
                        journey.open(source, variant: journeyNavigation)
                    }
                },
                onCallOff: { playerStore.cancelQueued() }
            )
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    /// Web: 2-col grid of white-outlined buttons.
    private var actionButtons: some View {
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
    }

    /// Tracklist in a translucent panel (web: bg-black/20).
    private var tracklistPanel: some View {
        TracklistView(
            tracks: tracks,
            episode: episode,
            accent: accentBackground,
            textColor: fg,
            graph: episodesVM.trackGraph,
            onPlay: { track in
                guard let ts = track.timestamp else { return }
                if playerStore.currentEpisode?.id == episode.id {
                    playerStore.seek(to: Double(ts))
                } else {
                    Task { await playerStore.play(episode: episode, startingAt: Double(ts)) }
                }
            },
            onOpenConnections: { track in
                let appearance = TrackAppearance(episode: episode, track: track)
                // [journey-variants] fullScreen has to wait for this sheet to go
                if journeyNavigation.leavesTheSheet {
                    journey.pending = appearance
                    dismiss()
                } else {
                    journey.open(appearance, variant: journeyNavigation)
                }
            },
            // [journey-variants] non-nil only for the inline variant
            expandedOrder: journeyNavigation == .inlineList ? $journey.expandedOrder : .constant(nil),
            onPickConnection: { landed in
                journey.expandedOrder = nil
                onNavigate?(landed)
            }
        )
        .background(Color.black.opacity(0.2))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var downloadState: DownloadState {
        downloadsStore.state(for: episode.id)
    }

    private var topBar: some View {
        HStack(spacing: 0) {
            Button(action: { dismiss() }) {
                Image(systemName: "chevron.down")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(fg.opacity(0.8))
                    .frame(width: 44, height: isDocked ? 34 : 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")

            Spacer(minLength: 0)

            // The handle is a drag affordance, and a landscape sheet is
            // full-screen with nothing to drag — so it only shows when true.
            if !isDocked {
                Capsule()
                    .fill(fg.opacity(0.3))
                    .frame(width: 40, height: 4)

                Spacer(minLength: 0)
            }

            EpisodeKebabButton(tint: fg.opacity(0.8), size: CGSize(width: 44, height: isDocked ? 34 : 44)) {
                showActions = true
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, isDocked ? 2 : 6)
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

}

// MARK: - Player controls (embedded in sheet)

private struct PlayerControlsSection: View {
    let episode: Episode
    /// The sheet's accent — the web colors the play glyph with it
    /// (`text-accent` on the white circle).
    let accent: Color
    /// Text/glyph color over the accent background.
    let textColor: Color
    /// Docked (landscape) mode trades glyph size for vertical room.
    var compact: Bool = false
    /// The sheet's own inset when the controls sit in a full-width column; the
    /// dock supplies its own margins, so it passes 0.
    var horizontalPadding: CGFloat = sheetHPadding
    @EnvironmentObject var playerStore: PlayerStore

    @State private var scrubTime: Double? = nil

    private var isCurrentEpisode: Bool { playerStore.currentEpisode?.id == episode.id }

    private var playButtonSize: CGFloat { compact ? 58 : 72 }
    private var playGlyphSize: CGFloat { compact ? 22 : 28 }
    private var skipGlyphSize: CGFloat { compact ? 24 : 30 }

    var body: some View {
        VStack(spacing: compact ? 8 : 14) {
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
                    .padding(.horizontal, horizontalPadding)

                    HStack {
                        Text(formatTime(scrubTime ?? playerStore.currentTime))
                        Spacer()
                        Text(formatTime(playerStore.duration))
                    }
                    .font(.app(size: compact ? 11 : 12))
                    .foregroundColor(textColor)
                    .padding(.horizontal, horizontalPadding)
                    // The slider's 44pt touch target leaves ~20pt of dead space
                    // below the visible bar; pull the times up to sit closer to it.
                    .padding(.top, -14)
                }
            }

            // Buttons (web: big white 30s skips around a white circle whose
            // play/pause glyph is accent-colored)
            HStack(spacing: compact ? 18 : 24) {
                if isCurrentEpisode {
                    Button(action: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        playerStore.rewind(30)
                    }) {
                        Image(systemName: "gobackward.30")
                            .font(.system(size: skipGlyphSize))
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
                            .frame(width: playButtonSize, height: playButtonSize)

                        if isCurrentEpisode && playerStore.isLoading {
                            ProgressView().tint(accent).scaleEffect(1.2)
                        } else {
                            let icon = isCurrentEpisode && playerStore.isPlaying ? "pause.fill" : "play.fill"
                            Image(systemName: icon)
                                .font(.system(size: playGlyphSize))
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
                            .font(.system(size: skipGlyphSize))
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
    /// Which other sets played each of these records — the sideways badge.
    let graph: TrackGraph
    /// What a tap on the row means. Hoisted out of the row because the journey
    /// renders this same tracklist and has more to do on a play than the sheet
    /// does (leave the radio, tell the sheet underneath where we went).
    let onPlay: (EpisodeTrack) -> Void
    let onOpenConnections: (EpisodeTrack) -> Void
    // [journey-variants] inline expansion; defaults keep other call sites as-is
    var expandedOrder: Binding<Int?> = .constant(nil)
    var onPickConnection: (Episode) -> Void = { _ in }
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
                VStack(spacing: 0) {
                    TrackRow(
                        track: track,
                        accent: accent,
                        textColor: textColor,
                        isCurrent: isCurrent,
                        connections: graph.connectionCount(of: track, excluding: episode.id),
                        onPlay: { onPlay(track) },
                        onOpenConnections: { onOpenConnections(track) }
                    )

                    // [journey-variants] inline: the connections hang off the row
                    if expandedOrder.wrappedValue == track.order {
                        InlineConnections(
                            appearance: TrackAppearance(episode: episode, track: track),
                            textColor: textColor,
                            onPick: onPickConnection
                        )
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .animation(.spring(response: 0.34, dampingFraction: 0.8), value: expandedOrder.wrappedValue)
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
    let accent: Color
    let textColor: Color
    let isCurrent: Bool
    /// How many other sets played this record. 0 leaves the connection out but
    /// keeps its column, so timestamps stay in line down the whole tracklist.
    let connections: Int
    let onPlay: () -> Void
    let onOpenConnections: () -> Void

    var body: some View {
        // The seek area and the connection are siblings, not a button inside a
        // button, so each gets its own taps (same shape as EpisodeRowView's
        // row-and-kebab).
        ZStack(alignment: .leading) {
            // Left current-track bar
            Rectangle()
                .fill(textColor)
                .frame(width: 2)
                .opacity(isCurrent ? 1 : 0)
                .animation(.easeInOut(duration: 0.3), value: isCurrent)

            HStack(spacing: 8) {
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

                    Spacer(minLength: 8)

                    if let ts = track.formattedTimestamp {
                        Text(ts)
                            .font(.app(size: 12))
                            .foregroundColor(textColor)
                    }
                }
                .padding(.leading, 16)
                .padding(.vertical, 8)
                .contentShape(Rectangle())
                .onTapGesture { onPlay() }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)

                TrackConnectionsSlot(count: connections, tint: textColor, action: onOpenConnections)
            }
            .padding(.trailing, 16)
        }
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

// MARK: - On deck

/// What the mini player says in one line, with room to say it properly: which
/// set is next, how it's getting there, and how long the record has left.
private struct OnDeckPanel: View {
    let queued: QueuedTransition
    let remaining: Double
    let isTransitioning: Bool
    /// The sheet's accent, worn by the content on the white pill.
    let accent: Color
    /// Tapping the panel — everything but the call-off cross — goes to where
    /// this was arranged from.
    let onShowSource: () -> Void
    let onCallOff: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            EpisodeArtwork(episode: queued.episode)
                .frame(width: 36, height: 36)
                .clipShape(RoundedRectangle(cornerRadius: 5))

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Image(systemName: queued.audio.symbol)
                        .font(.system(size: 9, weight: .bold))
                    Text(headline)
                        .font(.app(size: 11, weight: .bold))
                        .tracking(0.7)
                }
                .foregroundColor(.white)

                Text(queued.episode.name)
                    .font(.app(size: 13, weight: .medium))
                    .foregroundColor(.white.opacity(0.8))
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            Text(countdown)
                .font(.app(size: 13, weight: .bold))
                .monospacedDigit()
                .foregroundColor(accent)
                .padding(.horizontal, 9)
                .padding(.vertical, 5)
                .background(Capsule().fill(Color.white))

            Button(action: onCallOff) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.8))
                    .frame(width: 28, height: 28)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Call off the transition")
            // Above the panel's own tap, so the cross keeps working as a way
            // out rather than becoming another way in.
            .zIndex(1)
        }
        .padding(.leading, 10)
        .padding(.trailing, 4)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.black.opacity(0.25)))
        .contentShape(RoundedRectangle(cornerRadius: 10))
        .onTapGesture {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onShowSource()
        }
        .accessibilityHint("Shows where this transition was arranged from")
    }

    private var headline: String {
        isTransitioning ? "IN TRANSITION" : "ON DECK · \(queued.audio.title.uppercased())"
    }

    private var countdown: String {
        guard !isTransitioning else { return "NOW" }
        let seconds = Int(remaining.rounded())
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
