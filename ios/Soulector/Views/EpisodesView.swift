import SwiftUI

enum EpisodeTab: String, CaseIterable {
    case all       = "All Episodes"
    case favorites = "Favorites"
}

struct EpisodesView: View {
    @EnvironmentObject var episodesVM: EpisodesViewModel
    @EnvironmentObject var playerStore: PlayerStore
    @EnvironmentObject var favoritesStore: FavoritesStore

    @State private var selectedTab: EpisodeTab = .all
    @State private var showSearch = false
    @State private var selectedEpisode: Episode?
    @State private var showCollectivePicker = false
    @State private var navBarHeight: CGFloat = 0

    private var displayedEpisodes: [Episode] {
        selectedTab == .all
            ? episodesVM.filteredEpisodes
            : episodesVM.favoriteEpisodes(favoritesStore: favoritesStore)
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

            // Mini player pinned to bottom
            if playerStore.hasEpisode {
                MiniPlayerView(onTap: { selectedEpisode = playerStore.currentEpisode })
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.3), value: playerStore.hasEpisode)
        .task { await episodesVM.fetchEpisodes() }
        .onAppear {
            playerStore.onEpisodeEnded = { [weak episodesVM] finished in
                guard let vm = episodesVM,
                      let idx = vm.filteredEpisodes.firstIndex(where: { $0.id == finished.id }),
                      idx + 1 < vm.filteredEpisodes.count
                else { return }
                let next = vm.filteredEpisodes[idx + 1]
                Task { await playerStore.play(episode: next) }
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
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.white)
                    Image(systemName: showCollectivePicker ? "chevron.up" : "chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white.opacity(0.6))
                }
            }
            .buttonStyle(.plain)

            Spacer()

            HStack(spacing: 4) {
                // Shuffle
                Button(action: {
                    if let episode = episodesVM.filteredEpisodes.randomElement() {
                        Task { await playerStore.play(episode: episode) }
                    }
                }) {
                    Image(systemName: "shuffle")
                        .font(.system(size: 18))
                        .foregroundColor(.white)
                        .frame(width: 40, height: 40)
                }

                // Search toggle
                Button(action: { withAnimation(.easeInOut(duration: 0.2)) { showSearch.toggle() } }) {
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

            TextField("Search episodes...", text: $episodesVM.searchText)
                .foregroundColor(.white)
                .tint(.white)
                .autocorrectionDisabled()

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
    }

    private var tabSelector: some View {
        HStack(spacing: 8) {
            ForEach(EpisodeTab.allCases, id: \.self) { tab in
                Button(action: { selectedTab = tab }) {
                    Text(tab.rawValue)
                        .font(.system(size: 14, weight: selectedTab == tab ? .semibold : .regular))
                        .foregroundColor(selectedTab == tab ? .black : .white.opacity(0.6))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(selectedTab == tab ? Color.white : Color.white.opacity(0.12))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }

            Spacer()

            Text("\(displayedEpisodes.count) Total")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white.opacity(0.4))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
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
                    .font(.system(size: 18, weight: .bold))
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
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
            }
        case .sashaMarieRadio:
            Text("SASHA MARIE RADIO")
                .font(.system(size: 16, weight: .bold))
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
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
            }
        }
    }

    @ViewBuilder
    private var episodeListContent: some View {
        if episodesVM.isLoading {
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
                    .font(.headline)
                    .foregroundColor(.white)
                Text(error.localizedDescription)
                    .font(.caption)
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
                Text(selectedTab == .favorites ? "No favorites yet" : "No episodes found")
                    .foregroundColor(.white.opacity(0.5))
                Spacer()
            }
        } else {
            List {
                ForEach(displayedEpisodes) { episode in
                    EpisodeRowView(
                        episode: episode,
                        isPlaying: playerStore.currentEpisode?.id == episode.id,
                        isFavorite: favoritesStore.isFavorite(episode.id),
                        onTap: {
                            selectedEpisode = episode
                            Task { await playerStore.play(episode: episode) }
                        },
                        onFavorite: { favoritesStore.toggleFavorite(episode.id) }
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
