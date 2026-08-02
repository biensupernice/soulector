import Foundation

/// Deep links the widget opens and the app handles. The widget process can't
/// drive the app's `AVPlayer`, so each action is a `soulector://` URL that
/// brings the app forward and performs the action there. The scheme is
/// registered in the app's `Info.plist` (`CFBundleURLTypes`) and dispatched in
/// `EpisodesView.onOpenURL`.
enum SoulectorAction: String {
    /// Tune in to the live radio (mirrors the FAB's radio side).
    case tuneIn = "tune-in"
    /// Play a random episode (mirrors the FAB's Play Random side).
    case shuffle = "shuffle"
    /// Toggle play/pause on the current episode.
    case togglePlayPause = "toggle"
    /// Bring up the now-playing sheet for the current episode.
    case openNowPlaying = "now-playing"

    static let scheme = "soulector"

    var url: URL {
        URL(string: "\(Self.scheme)://\(rawValue)")!
    }

    init?(url: URL) {
        guard url.scheme == Self.scheme else { return nil }
        // soulector://tune-in → host carries the action.
        let key = url.host ?? url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let action = SoulectorAction(rawValue: key) else { return nil }
        self = action
    }
}
