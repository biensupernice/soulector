import Foundation

final class FavoritesStore: ObservableObject {
    @Published private(set) var favoriteIds: Set<String>

    private let userDefaultsKey = "soulector.favoriteIds"

    init() {
        let saved = UserDefaults.standard.stringArray(forKey: "soulector.favoriteIds") ?? []
        favoriteIds = Set(saved)
    }

    func isFavorite(_ id: String) -> Bool {
        favoriteIds.contains(id)
    }

    func toggleFavorite(_ id: String) {
        if favoriteIds.contains(id) {
            favoriteIds.remove(id)
        } else {
            favoriteIds.insert(id)
        }
        persist()
    }

    private func persist() {
        UserDefaults.standard.set(Array(favoriteIds), forKey: userDefaultsKey)
    }
}
