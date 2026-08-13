import SwiftUI

@main
struct SoulectorApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        // iOS relaunches the app here when a download finishes while we aren't
        // running. Reaching for the shared store rebuilds the background
        // sessions so their delegate can file the finished audio away; the
        // await keeps us alive until the session says it's handed everything
        // over. Both identifiers are registered because downloads land on one
        // of two sessions — HLS on the asset session, progressive files on the
        // original one (see DownloadsStore).
        .backgroundTask(.urlSession(DownloadsStore.sessionIdentifier)) {
            let downloads = await DownloadsStore.shared
            await downloads.handleBackgroundSessionEvents()
        }
        .backgroundTask(.urlSession(DownloadsStore.assetSessionIdentifier)) {
            let downloads = await DownloadsStore.shared
            await downloads.handleBackgroundSessionEvents()
        }
    }
}
