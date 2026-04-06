import SwiftUI

struct ContentView: View {
    @StateObject private var playerStore = PlayerStore()
    @StateObject private var favoritesStore = FavoritesStore()
    @StateObject private var episodesVM = EpisodesViewModel()

    var body: some View {
        EpisodesView()
            .environmentObject(playerStore)
            .environmentObject(favoritesStore)
            .environmentObject(episodesVM)
            .preferredColorScheme(.dark)
    }
}
