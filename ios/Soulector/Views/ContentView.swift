import SwiftUI

struct ContentView: View {
    @StateObject private var playerStore = PlayerStore()
    @StateObject private var favoritesStore = FavoritesStore()
    @StateObject private var episodesVM = EpisodesViewModel()
    @StateObject private var radioStore = RadioStore()

    var body: some View {
        EpisodesView()
            .environmentObject(playerStore)
            .environmentObject(favoritesStore)
            .environmentObject(episodesVM)
            .environmentObject(radioStore)
            .preferredColorScheme(.dark)
    }
}
