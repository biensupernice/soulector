import Foundation

struct EpisodeTrack: Identifiable, Equatable, Hashable, Codable {
    let order: Int
    let name: String
    let artist: String
    let timestamp: Int? // seconds from start

    var id: Int { order }

    var formattedTimestamp: String? {
        guard let ts = timestamp else { return nil }
        let h = ts / 3600
        let m = (ts % 3600) / 60
        let s = ts % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }
}

extension Array where Element == EpisodeTrack {
    /// The record playing at `seconds`: the last one whose timestamp has gone by.
    /// Tracks with no timestamp can't be placed on the clock, so they're skipped.
    func playing(at seconds: Double) -> EpisodeTrack? {
        last { track in
            guard let timestamp = track.timestamp else { return false }
            return Double(timestamp) <= seconds
        }
    }
}
