import SwiftUI

enum EpisodeTab: String, CaseIterable {
    case all       = "All Episodes"
    case favorites = "Favorites"
    case downloads = "Downloads"
}

struct EpisodesView: View {
    @EnvironmentObject var episodesVM: EpisodesViewModel
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var favoritesStore: FavoritesStore
    @EnvironmentObject var radioStore: RadioStore
    @EnvironmentObject var downloadsStore: DownloadsStore
    @EnvironmentObject var network: NetworkMonitor

    @State private var selectedTab: EpisodeTab = .all
    @State private var showSearch = false
    @State private var selectedEpisode: Episode?
    @State private var actionsEpisode: Episode?
    @State private var showCollectivePicker = false
    @State private var navBarHeight: CGFloat = 0
    @State private var tabMetrics = TabScrollMetrics()
    @State private var tabViewportWidth: CGFloat = 0
    @FocusState private var searchFieldFocused: Bool

    private static let tabScrollSpace = "episodeTabs"
    private static let tabFadeWidth: CGFloat = 20

    private var displayedEpisodes: [Episode] {
        switch selectedTab {
        case .all:       return episodesVM.filteredEpisodes
        case .favorites: return episodesVM.favoriteEpisodes(favoritesStore: favoritesStore)
        case .downloads: return episodesVM.downloadedEpisodes(downloadsStore: downloadsStore)
        }
    }

    /// Downloads only earns a pill once there's something in it — an empty
    /// third tab would just be clutter for anyone who never downloads.
    private var visibleTabs: [EpisodeTab] {
        EpisodeTab.allCases.filter { $0 != .downloads || !downloadsStore.isEmpty }
    }

    private var isSearching: Bool {
        !episodesVM.searchText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                // Navigation bar area
                navBar

                // Search bar
                if showSearch {
                    searchBar
                }

                // Tab pills + count
                tabSelector

                // Episode list
                episodeListContent
            }
            .overlay(alignment: .topLeading) {
                if showCollectivePicker {
                    ZStack(alignment: .topLeading) {
                        Color.black.opacity(0.01)
                            .ignoresSafeArea()
                            .onTapGesture {
                                withAnimation(.spring(duration: 0.2)) { showCollectivePicker = false }
                            }
                        collectiveDropdown
                            .padding(.top, navBarHeight)
                    }
                    .transition(.opacity.combined(with: .scale(scale: 0.95, anchor: .topLeading)))
                }
            }
            .sheet(item: $selectedEpisode) { episode in
                EpisodeDetailSheet(episode: episode)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.hidden)
            }

            // Floating radio/shuffle cluster (mirrors the web PlayerFabs),
            // tucked into the bottom-right corner above the mini player.
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    PlayerFabs(
                        on: radioStore.isOn,
                        accent: playerStore.accentOnLight,
                        // The broadcast is live audio — there's nothing to tune
                        // into without a connection.
                        radioAvailable: network.isOnline,
                        onRadioTap: {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            if radioStore.isOn {
                                radioStore.tuneOut()
                            } else {
                                radioStore.tuneIn()
                            }
                        },
                        onShuffleTap: {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            radioStore.tuneOut()
                            if let episode = shufflePool.randomElement() {
                                Task { await playerStore.play(episode: episode) }
                            }
                        }
                    )
                }
            }
            .padding(.trailing, 16)
            .padding(.bottom, playerStore.hasEpisode ? 76 : 16)
            .ignoresSafeArea(.keyboard, edges: .bottom)

            // Mini player pinned to the bottom of the *screen*, not to the top
            // of the keyboard. Search raises the keyboard, and riding it up
            // parks the bar right on top of the results — the scarcest space
            // there is while typing. Left under the keyboard it costs nothing,
            // and scrolling the results dismisses the keyboard
            // (SearchResultsView), which hands the controls straight back.
            //
            // The full-height stack is what does the pinning, same as the FAB
            // cluster above: `ignoresSafeArea` only lets a view extend into the
            // unsafe region, it does not move one the ZStack has already
            // bottom-aligned inside keyboard-shrunk bounds. The Spacer pushes
            // the bar down through a container that keeps its full height.
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                if playerStore.hasEpisode {
                    MiniPlayerView(onTap: { selectedEpisode = playerStore.currentEpisode })
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .ignoresSafeArea(.keyboard, edges: .bottom)
        }
        // Attached out here rather than next to the detail sheet: two `.sheet`
        // modifiers on the same view fight over the presentation.
        .sheet(item: $actionsEpisode) { episode in
            EpisodeActionsSheet(episode: episode)
        }
        .animation(.spring(duration: 0.3), value: playerStore.hasEpisode)
        // Removing the last download takes its tab away with it.
        .onChange(of: downloadsStore.isEmpty) { isEmpty in
            if isEmpty && selectedTab == .downloads { selectedTab = .all }
        }
        .task { await episodesVM.fetchEpisodes() }
        .onAppear {
            radioStore.configure(player: playerStore, episodesVM: episodesVM)
            playerStore.onEpisodeEnded = { [weak episodesVM, weak playerStore, weak radioStore] finished in
                // While on air the schedule decides what plays next, not the
                // list order. A natural end keeps the radio waiting for the
                // slot boundary; "next track" from the lock screen while
                // audio is still playing is the user taking over.
                if let radioStore, radioStore.isOn {
                    if playerStore?.isPlaying == true {
                        radioStore.tuneOut()
                    } else {
                        radioStore.handlePlaybackEnded()
                        return
                    }
                }
                guard let vm = episodesVM,
                      let playerStore,
                      let idx = vm.filteredEpisodes.firstIndex(where: { $0.id == finished.id }),
                      idx + 1 < vm.filteredEpisodes.count
                else { return }
                let next = vm.filteredEpisodes[idx + 1]
                Task { await playerStore.play(episode: next) }
            }
        }
        // Deep links from the home-screen widget (soulector://…). These mirror
        // the floating FAB cluster and the mini player's play/pause.
        .onOpenURL { url in
            guard let action = SoulectorAction(url: url) else { return }
            switch action {
            case .tuneIn:
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                if !radioStore.isOn { radioStore.tuneIn() }
            case .shuffle:
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                radioStore.tuneOut()
                if let episode = episodesVM.filteredEpisodes.randomElement() {
                    Task { await playerStore.play(episode: episode) }
                }
            case .togglePlayPause:
                if playerStore.hasEpisode {
                    playerStore.togglePlayPause()
                } else if !radioStore.isOn {
                    // Nothing loaded yet — tapping play tunes in to the radio.
                    radioStore.tuneIn()
                }
            case .openNowPlaying:
                if let episode = playerStore.currentEpisode {
                    selectedEpisode = episode
                }
            }
        }
    }

    // MARK: - Subviews

    private var navBar: some View {
        HStack {
            // Collective picker
            Button(action: {
                withAnimation(.spring(duration: 0.2)) { showCollectivePicker.toggle() }
            }) {
                HStack(spacing: 5) {
                    Text(episodesVM.selectedCollective.displayName)
                        .font(.app(size: 22, weight: .bold))
                        .foregroundColor(.white)
                    Image(systemName: showCollectivePicker ? "chevron.up" : "chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white.opacity(0.6))
                }
            }
            .buttonStyle(.plain)

            Spacer()

            HStack(spacing: 4) {
                // Search toggle (shuffle lives in the floating cluster below)
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) { showSearch.toggle() }
                    if showSearch {
                        Task { await episodesVM.refreshSearchIndex() }
                    } else {
                        episodesVM.searchText = ""
                    }
                }) {
                    Image(systemName: showSearch ? "xmark" : "magnifyingglass")
                        .font(.system(size: 18))
                        .foregroundColor(.white)
                        .frame(width: 40, height: 40)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            GeometryReader { geo in
                Color.clear.onAppear { navBarHeight = geo.size.height }
            }
        )
    }

    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.white.opacity(0.5))

            TextField("Search episodes and tracks...", text: $episodesVM.searchText)
                .foregroundColor(.white)
                .tint(.white)
                .focused($searchFieldFocused)
                // Results update live as you type, so there's nothing to submit.
                // No autocapitalization/autocorrect (episode, track, and artist
                // names aren't dictionary words, and search is case- and
                // diacritic-insensitive), and the return key resigns focus so it
                // acts as "done — show me the results" instead of a dead key.
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)
                .onSubmit { searchFieldFocused = false }

            if !episodesVM.searchText.isEmpty {
                Button(action: { episodesVM.searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.white.opacity(0.5))
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        // Raise the keyboard as soon as the search bar appears. The tiny delay
        // lets the show/hide transition settle so the focus reliably takes and
        // the keyboard animates up (focusing mid-transition can get dropped).
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                searchFieldFocused = true
            }
        }
    }

    private var tabSelector: some View {
        HStack(spacing: 8) {
            // Scrolls rather than truncates: a third pill plus the count runs
            // past the width of the narrowest phones we support.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(visibleTabs, id: \.self) { tab in
                        Button(action: { selectedTab = tab }) {
                            Text(tab.rawValue)
                                .font(.app(size: 14, weight: selectedTab == tab ? .semibold : .regular))
                                .foregroundColor(selectedTab == tab ? .black : .white.opacity(0.6))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 7)
                                .background(selectedTab == tab ? Color.white : Color.white.opacity(0.12))
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(
                    GeometryReader { proxy in
                        let frame = proxy.frame(in: .named(Self.tabScrollSpace))
                        Color.clear.preference(
                            key: TabScrollMetricsKey.self,
                            value: TabScrollMetrics(offset: -frame.minX, contentWidth: frame.width)
                        )
                    }
                )
            }
            .fixedSize(horizontal: false, vertical: true)
            .coordinateSpace(name: Self.tabScrollSpace)
            .background(
                GeometryReader { proxy in
                    Color.clear.preference(key: TabViewportWidthKey.self, value: proxy.size.width)
                }
            )
            .onPreferenceChange(TabScrollMetricsKey.self) { tabMetrics = $0 }
            .onPreferenceChange(TabViewportWidthKey.self) { tabViewportWidth = $0 }
            // A pill sliced mid-word at the edge reads as a rendering bug.
            // Fading it says "there's more this way" instead — and only on the
            // side that actually has more, so a fully scrolled row looks solid.
            .mask(tabScrollFade)

            Spacer(minLength: 8)

            Text(countText)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white.opacity(0.4))
                .lineLimit(1)
                .layoutPriority(1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    /// Opaque through the middle, fading over `tabFadeWidth` on whichever edge
    /// has content hidden past it. Zero-width when there's nothing to reveal,
    /// so the first and last pill keep their full contrast.
    private var tabScrollFade: some View {
        HStack(spacing: 0) {
            LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing)
                .frame(width: tabFadeLeading ? Self.tabFadeWidth : 0)

            Color.black

            LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing)
                .frame(width: tabFadeTrailing ? Self.tabFadeWidth : 0)
        }
        .animation(.easeOut(duration: 0.2), value: tabFadeLeading)
        .animation(.easeOut(duration: 0.2), value: tabFadeTrailing)
    }

    // A pixel of slack so rounding at the scroll limits doesn't leave a fade on.
    private var tabFadeLeading: Bool { tabMetrics.offset > 1 }
    private var tabFadeTrailing: Bool {
        tabMetrics.contentWidth - tabViewportWidth - tabMetrics.offset > 1
    }

    private var countText: String {
        if isSearching {
            let results = episodesVM.searchResults
            let episodeWord = results.count == 1 ? "episode" : "episodes"
            var text = "\(results.count) \(episodeWord)"
            let trackCount = results.reduce(0) { $0 + $1.matchedTracks.count }
            if trackCount > 0 {
                text += " · \(trackCount) \(trackCount == 1 ? "track" : "tracks")"
            }
            return text
        }
        // Offline, the honest count is what's actually playable — and it
        // explains why the rest of the list has gone quiet.
        if !network.isOnline {
            let count = downloadsStore.downloadedEpisodes.count
            return count > 0 ? "Offline · \(count) downloaded" : "Offline"
        }
        if selectedTab == .downloads {
            return "\(displayedEpisodes.count) · \(downloadsStore.formattedTotalSize)"
        }
        return "\(displayedEpisodes.count) Total"
    }

    /// Shuffle stays useful with no network by drawing from what's on the device.
    private var shufflePool: [Episode] {
        network.isOnline
            ? episodesVM.filteredEpisodes
            : episodesVM.downloadedEpisodes(downloadsStore: downloadsStore)
    }

    private var collectiveDropdown: some View {
        VStack(spacing: 0) {
            ForEach(Array(CollectiveFilter.allCases.enumerated()), id: \.element.id) { index, collective in
                if index == 1 {
                    Divider()
                        .overlay(Color.white.opacity(0.12))
                }
                Button(action: {
                    withAnimation(.spring(duration: 0.2)) { showCollectivePicker = false }
                    episodesVM.selectCollective(collective)
                }) {
                    HStack(spacing: 0) {
                        collectiveLogo(collective)
                        Spacer()
                        if episodesVM.selectedCollective == collective {
                            Image(systemName: "checkmark")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.trailing, 16)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.plain)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(white: 0.15))
                .shadow(color: .black.opacity(0.4), radius: 20, x: 0, y: 8)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .zIndex(100)
    }

    @ViewBuilder
    private func collectiveLogo(_ collective: CollectiveFilter) -> some View {
        switch collective {
        case .all:
            HStack(spacing: 12) {
                Image(systemName: "square.stack.fill")
                    .font(.system(size: 22))
                    .frame(width: 28)
                    .foregroundColor(.white)
                Text("All Collectives")
                    .font(.app(size: 18, weight: .bold))
                    .foregroundColor(.white)
            }
        case .soulection:
            HStack(spacing: 12) {
                Image("SoulectionIcon")
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 28, height: 19)
                    .foregroundColor(.white)
                Text("Soulection")
                    .font(.app(size: 18, weight: .bold))
                    .foregroundColor(.white)
            }
        case .sashaMarieRadio:
            Text("SASHA MARIE RADIO")
                .font(.app(size: 16, weight: .bold))
                .tracking(1.5)
                .foregroundColor(.white)
        case .theLoveBelowHour:
            HStack(spacing: 12) {
                Image("TheLoveBelowIcon")
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 26, height: 26)
                    .foregroundColor(.white)
                Text("The Love Below Hour")
                    .font(.app(size: 18, weight: .bold))
                    .foregroundColor(.white)
            }
        }
    }

    private var emptyStateText: String {
        switch selectedTab {
        case .all:       return "No episodes found"
        case .favorites: return "No favorites yet"
        case .downloads: return "No downloads yet"
        }
    }

    @ViewBuilder
    private var episodeListContent: some View {
        if isSearching {
            SearchResultsView(
                results: episodesVM.searchResults,
                loading: episodesVM.isSearchIndexLoading,
                currentEpisodeId: playerStore.currentEpisode?.id,
                // The trailing spacer only has to clear the mini player. With
                // the keyboard up the bar sits behind it, so reserving that
                // room would just be a gap between the last result and the
                // keyboard.
                bottomPadding: playerStore.hasEpisode && !searchFieldFocused ? 70 : 0,
                onEpisodeTap: { episode in
                    radioStore.tuneOut()
                    selectedEpisode = episode
                    Task { await playerStore.play(episode: episode) }
                },
                onTrackTap: { episode, timestamp in
                    radioStore.tuneOut()
                    selectedEpisode = episode
                    Task { await playerStore.play(episode: episode, startingAt: timestamp.map(Double.init)) }
                },
                onShowActions: { actionsEpisode = $0 }
            )
        } else if episodesVM.isLoading && episodesVM.episodes.isEmpty {
            VStack {
                Spacer()
                ProgressView("Loading episodes…")
                    .tint(.white)
                    .foregroundColor(.white.opacity(0.6))
                Spacer()
            }
        } else if let error = episodesVM.error {
            VStack(spacing: 16) {
                Spacer()
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 40))
                    .foregroundColor(.white.opacity(0.5))
                Text("Couldn't load episodes")
                    .font(.app(size: 17, weight: .semibold))
                    .foregroundColor(.white)
                Text(error.localizedDescription)
                    .font(.app(size: 12))
                    .foregroundColor(.white.opacity(0.5))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                Button("Retry") {
                    Task { await episodesVM.fetchEpisodes() }
                }
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(Color.white.opacity(0.15))
                .clipShape(Capsule())
                Spacer()
            }
        } else if displayedEpisodes.isEmpty {
            VStack {
                Spacer()
                Text(emptyStateText)
                    .foregroundColor(.white.opacity(0.5))
                Spacer()
            }
        } else {
            List {
                ForEach(displayedEpisodes) { episode in
                    EpisodeRowView(
                        episode: episode,
                        isPlaying: playerStore.currentEpisode?.id == episode.id,
                        onTap: {
                            // Manual plays take over from the radio (web parity).
                            radioStore.tuneOut()
                            selectedEpisode = episode
                            Task { await playerStore.play(episode: episode) }
                        },
                        onShowActions: { actionsEpisode = episode }
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
                // Bottom padding so mini player doesn't cover last row
                Color.clear
                    .frame(height: playerStore.hasEpisode ? 70 : 0)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets())
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
    }
}

// MARK: - Tab strip scroll metrics

/// Where the tab strip is scrolled and how wide its content is, reported up
/// from inside the ScrollView so the edge fades know which side has more.
struct TabScrollMetrics: Equatable {
    var offset: CGFloat = 0
    var contentWidth: CGFloat = 0
}

private struct TabScrollMetricsKey: PreferenceKey {
    static let defaultValue = TabScrollMetrics()

    static func reduce(value: inout TabScrollMetrics, nextValue: () -> TabScrollMetrics) {
        value = nextValue()
    }
}

private struct TabViewportWidthKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}
