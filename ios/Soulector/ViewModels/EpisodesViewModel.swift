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
        case .all:              return "All Collectives"
        case .soulection:       return "Soulection"
        case .sashaMarieRadio:  return "Sasha Marie Radio"
        case .theLoveBelowHour: return "The Love Below Hour"
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

    /// Full episodes+tracks index that drives track-aware search. Populated from
    /// disk at init (instant search on launch) and refreshed from the network.
    @Published private(set) var searchIndex: [SearchIndexEpisode] = []
    private var isLoadingSearchIndex = false

    private let persistedCollectiveKey = "soulector.selectedCollective"

    private static let cacheURL: URL? = FileManager.default
        .urls(for: .cachesDirectory, in: .userDomainMask).first?
        .appendingPathComponent("episodes_cache.json")

    // Versioned filename so a shape change never decodes a stale snapshot.
    private static let searchIndexCacheURL: URL? = FileManager.default
        .urls(for: .cachesDirectory, in: .userDomainMask).first?
        .appendingPathComponent("search_index_cache_v1.json")

    init() {
        // Restore last-used collective
        if let raw = UserDefaults.standard.string(forKey: persistedCollectiveKey),
           let filter = CollectiveFilter(rawValue: raw) {
            selectedCollective = filter
        }
        // Populate from cache immediately so the list is visible before the network returns
        if let url = Self.cacheURL,
           let data = try? Data(contentsOf: url),
           let cached = try? JSONDecoder().decode([Episode].self, from: data) {
            episodes = cached
        }
        if let url = Self.searchIndexCacheURL,
           let data = try? Data(contentsOf: url),
           let cached = try? JSONDecoder().decode([SearchIndexEpisode].self, from: data) {
            searchIndex = cached
        }
    }

    private func persistCache(_ episodes: [Episode]) {
        guard let url = Self.cacheURL,
              let data = try? JSONEncoder().encode(episodes)
        else { return }
        try? data.write(to: url, options: .atomic)
    }

    private func persistSearchIndexCache(_ index: [SearchIndexEpisode]) {
        guard let url = Self.searchIndexCacheURL,
              let data = try? JSONEncoder().encode(index)
        else { return }
        try? data.write(to: url, options: .atomic)
    }

    // MARK: Derived lists

    /// Collective-scoped episode list (search is handled separately, see
    /// `searchResults`). Used for the regular list, shuffle scope, and
    /// auto-advance.
    var filteredEpisodes: [Episode] {
        applyFilters(to: episodes)
    }

    func favoriteEpisodes(favoritesStore: FavoritesStore) -> [Episode] {
        applyFilters(to: episodes).filter { favoritesStore.isFavorite($0.id) }
    }

    private func applyFilters(to list: [Episode]) -> [Episode] {
        guard selectedCollective != .all else { return list }
        return list.filter { $0.collectiveSlug == selectedCollective.rawValue }
    }

    // MARK: Track-aware search

    var searchResults: [EpisodeSearchResult] {
        EpisodeSearch.search(index: searchIndex, query: searchText, collective: selectedCollective)
    }

    /// True until the search index has been loaded (from cache or network) at
    /// least once, used to show a "loading library" state instead of "no matches".
    var isSearchIndexLoading: Bool { searchIndex.isEmpty }

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
            let fetched = try await APIClient.shared.fetchEpisodes()
            episodes = fetched
            persistCache(fetched)
        } catch {
            // Only surface the error when we have nothing to show
            if episodes.isEmpty { self.error = error }
        }
        isLoading = false
    }

    /// Refreshes the search index from the network. Safe to call repeatedly; a
    /// fetch in flight short-circuits. Failures are swallowed — cached data (if
    /// any) keeps search working.
    func refreshSearchIndex() async {
        guard !isLoadingSearchIndex else { return }
        isLoadingSearchIndex = true
        defer { isLoadingSearchIndex = false }
        do {
            let fetched = try await APIClient.shared.fetchSearchIndex()
            searchIndex = fetched
            persistSearchIndexCache(fetched)
        } catch {
            // Ignore; cached index (if present) still serves search this session.
        }
    }
}
