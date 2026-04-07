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

    private let persistedCollectiveKey = "soulector.selectedCollective"

    private static let cacheURL: URL? = FileManager.default
        .urls(for: .cachesDirectory, in: .userDomainMask).first?
        .appendingPathComponent("episodes_cache.json")

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
    }

    private func persistCache(_ episodes: [Episode]) {
        guard let url = Self.cacheURL,
              let data = try? JSONEncoder().encode(episodes)
        else { return }
        try? data.write(to: url, options: .atomic)
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
            let fetched = try await APIClient.shared.fetchEpisodes()
            episodes = fetched
            persistCache(fetched)
        } catch {
            // Only surface the error when we have nothing to show
            if episodes.isEmpty { self.error = error }
        }
        isLoading = false
    }
}
