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
    @State private var showEpisodeDetail = false
    @State private var showFullPlayer = false

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

                // Collective filter pills
                collectiveFilter

                // Search bar
                if showSearch {
                    searchBar
                }

                // Tab selector
                tabSelector

                Divider().background(Color.white.opacity(0.1))

                // Episode list
                episodeListContent
            }

            // Mini player pinned to bottom
            if playerStore.hasEpisode {
                MiniPlayerView(onTap: { showFullPlayer = true })
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.3), value: playerStore.hasEpisode)
        .task { await episodesVM.fetchEpisodes() }
        .sheet(isPresented: $showEpisodeDetail) {
            if let ep = selectedEpisode {
                EpisodeDetailSheet(episode: ep)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.hidden)
            }
        }
        .sheet(isPresented: $showFullPlayer) {
            FullPlayerView()
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
        }
    }

    // MARK: - Subviews

    private var navBar: some View {
        HStack {
            Text("Soulector")
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(.white)

            Spacer()

            HStack(spacing: 4) {
                // Shuffle
                Button(action: {
                    Task { await episodesVM.playRandom(playerStore: playerStore) }
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
    }

    private var collectiveFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(CollectiveFilter.allCases) { collective in
                    let isSelected = episodesVM.selectedCollective == collective
                    Button(action: { episodesVM.selectCollective(collective) }) {
                        Text(collective.displayName)
                            .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                            .foregroundColor(isSelected ? .black : .white.opacity(0.7))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(isSelected ? Color.white : Color.white.opacity(0.12))
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
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
        HStack(spacing: 0) {
            ForEach(EpisodeTab.allCases, id: \.self) { tab in
                Button(action: { selectedTab = tab }) {
                    VStack(spacing: 4) {
                        Text(tab.rawValue)
                            .font(.system(size: 14, weight: selectedTab == tab ? .semibold : .regular))
                            .foregroundColor(selectedTab == tab ? .white : .white.opacity(0.45))

                        Rectangle()
                            .fill(selectedTab == tab ? Color.white : Color.clear)
                            .frame(height: 2)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
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
                            showEpisodeDetail = true
                            Task { await episodesVM.playEpisode(episode, playerStore: playerStore) }
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
