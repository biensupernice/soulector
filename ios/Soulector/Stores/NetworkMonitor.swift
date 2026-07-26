import Foundation
import Network

/// Whether the device can reach the network at all. Used to tell the truth in
/// the episode list: without a connection, only downloaded episodes can play,
/// so everything else reads as unavailable instead of failing on tap.
@MainActor
final class NetworkMonitor: ObservableObject {
    @Published private(set) var isOnline = true

    /// Held for the app's lifetime — there's one monitor and it never stops.
    private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.isOnline = online }
        }
        monitor.start(queue: DispatchQueue(label: "com.soulector.app.network"))
    }
}
