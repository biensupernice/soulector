import SwiftUI

struct ContentView: View {
    @StateObject private var playerStore = PlayerStore()
    @StateObject private var favoritesStore = FavoritesStore()
    @StateObject private var episodesVM = EpisodesViewModel()
    @StateObject private var radioStore = RadioStore()
    @StateObject private var networkMonitor = NetworkMonitor()

    var body: some View {
        EpisodesView()
            .environmentObject(playerStore)
            .environmentObject(favoritesStore)
            .environmentObject(episodesVM)
            .environmentObject(radioStore)
            .environmentObject(networkMonitor)
            // Deliberately not a @StateObject: the downloads store owns a
            // background URLSession that iOS also revives outside the view tree
            // (see SoulectorApp), so it owns itself. Passing it down without
            // observing it here keeps download progress from re-rendering the
            // whole app.
            .environmentObject(DownloadsStore.shared)
            // Anything without an explicit font (text fields, plain buttons)
            // falls back to Space Grotesk at the body size.
            .environment(\.font, .app(size: 17))
            .preferredColorScheme(.dark)
    }
}
