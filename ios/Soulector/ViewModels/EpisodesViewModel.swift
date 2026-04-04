import Foundation

// MARK: - Collective filter

enum CollectiveFilter: String, CaseIterable, Identifiable {
    case all                = "all"
    case soulection         = "soulection"
    case sashaMarieRadio    = "sasha-marie-radio"
    case theLoveBelowHour   = "the-love-below-hour"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .all:              return "All"
        case .soulection:       return "Soulection"
        case .sashaMarieRadio:  return "Sasha Marie"
        case .theLoveBelowHour: return "The Love Below"
        }
    }
}

// MARK: - EpisodesViewModel

@MainActor
final class EpisodesViewModel: ObservableObject {
    @Published private(set) var episodes: [Episode] = []
    @Published private(set) var isLoading = false
    @Published private(set) var error: Error?

    @Published var selectedCollective: CollectiveFilter = .soulection
    @Published var searchText = ""

    private let persistedCollectiveKey = "soulector.selectedCollective"

    init() {
        // Restore last-used collective
        if let raw = UserDefaults.standard.string(forKey: persistedCollectiveKey),
           let filter = CollectiveFilter(rawValue: raw) {
            selectedCollective = filter
        }
    }

    // MARK: Derived lists

    var filteredEpisodes: [Episode] {
        applyFilters(to: episodes)
    }

    func favoriteEpisodes(favoritesStore: FavoritesStore) -> [Episode] {
        applyFilters(to: episodes).filter { favoritesStore.isFavorite($0.id) }
    }

    private func applyFilters(to list: [Episode]) -> [Episode] {
        var result = list
        if selectedCollective != .all {
            result = result.filter { $0.collectiveSlug == selectedCollective.rawValue }
        }
        if !searchText.trimmingCharacters(in: .whitespaces).isEmpty {
            result = result.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
        }
        return result
    }

    // MARK: Collective selection

    func selectCollective(_ filter: CollectiveFilter) {
        selectedCollective = filter
        UserDefaults.standard.set(filter.rawValue, forKey: persistedCollectiveKey)
    }

    // MARK: Data fetching

    func fetchEpisodes() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        do {
            episodes = try await APIClient.shared.fetchEpisodes()
        } catch {
            self.error = error
        }
        isLoading = false
    }

    // MARK: Playback coordination

    /// Fetches the stream URL and hands off to PlayerStore.
    func playEpisode(_ episode: Episode, playerStore: PlayerStore) async {
        // Immediately update player state so UI responds
        playerStore.loadAndPlay(episode: episode, streamUrl: "")
        // Then fetch the real URL
        do {
            guard let urls = try await APIClient.shared.fetchStreamUrl(episodeId: episode.id),
                  !urls.httpMp3128Url.isEmpty else {
                return
            }
            playerStore.loadAndPlay(episode: episode, streamUrl: urls.httpMp3128Url)
        } catch {
            print("[EpisodesViewModel] Stream URL fetch failed: \(error)")
        }
    }

    func playRandom(playerStore: PlayerStore) async {
        let pool = filteredEpisodes
        guard let episode = pool.randomElement() else { return }
        await playEpisode(episode, playerStore: playerStore)
    }
}
