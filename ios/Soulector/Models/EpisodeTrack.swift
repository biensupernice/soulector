import Foundation

struct EpisodeTrack: Identifiable, Equatable, Decodable {
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
