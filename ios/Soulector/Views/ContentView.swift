import SwiftUI

struct ContentView: View {
    @StateObject private var playerStore = PlayerStore()
    @StateObject private var favoritesStore = FavoritesStore()
    @StateObject private var episodesVM = EpisodesViewModel()
    @StateObject private var radioStore = RadioStore()
    @StateObject private var networkMonitor = NetworkMonitor()
    @StateObject private var journey = JourneyCoordinator()
    @State private var showDiagnostics = false

    /// Which journey navigation is under trial. Read once here and put into the
    /// environment rather than re-read per screen, so switching reaches an
    /// open journey and the list underneath it in the same frame.
    @AppStorage(JourneyNavigation.storageKey) private var journeyNavigation = JourneyNavigation.current
    @AppStorage(JourneyLayers.storageKey) private var journeyLayers = JourneyLayers.none
    @AppStorage(TrackEpisodesStyle.storageKey) private var trackEpisodesStyle = TrackEpisodesStyle.current
    @AppStorage(TrackEpisodesExtras.storageKey) private var trackEpisodesExtras = TrackEpisodesExtras.none
    @AppStorage(ArmedRowStyle.storageKey) private var armedRowStyle = ArmedRowStyle.current

    var body: some View {
        EpisodesView()
            .journeyNavigation(journeyNavigation)
            .journeyLayers(journeyLayers)
            .trackEpisodesOptions(
                style: trackEpisodesStyle,
                extras: trackEpisodesExtras,
                armedRow: armedRowStyle
            )
            .environmentObject(playerStore)
            .environmentObject(favoritesStore)
            .environmentObject(episodesVM)
            .environmentObject(radioStore)
            .environmentObject(networkMonitor)
            .environmentObject(journey)
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
            // Shake anywhere to read what the app was doing — including what it
            // was doing when it died last time.
            .sensesShake()
            .onReceive(NotificationCenter.default.publisher(for: .deviceDidShake)) { _ in
                showDiagnostics = true
            }
            .sheet(isPresented: $showDiagnostics) { DiagnosticsSheet() }
            .onAppear { Diagnostics.install() }
    }
}
