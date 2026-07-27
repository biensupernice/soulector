import SwiftUI

@main
struct SoulectorApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        // iOS relaunches the app here when a download finishes while we aren't
        // running. Reaching for the shared store rebuilds the background session
        // so its delegate can file the finished audio away; the await keeps us
        // alive until the session says it's handed everything over.
        .backgroundTask(.urlSession(DownloadsStore.sessionIdentifier)) {
            let downloads = await DownloadsStore.shared
            await downloads.handleBackgroundSessionEvents()
        }
    }
}
