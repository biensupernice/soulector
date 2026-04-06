import Foundation

struct Episode: Identifiable, Equatable, Hashable, Decodable {
    let id: String
    let source: String
    let duration: Int // seconds
    let releasedAt: String
    let name: String
    let permalinkUrl: String
    let collectiveSlug: String
    let artworkUrl: String

    // Note: JSON also contains "createadAt" (typo) and "embedPlayerKey" (Int or String),
    // both are intentionally omitted from CodingKeys so they are silently ignored.
    private enum CodingKeys: String, CodingKey {
        case id, source, duration, releasedAt, name, permalinkUrl, collectiveSlug, artworkUrl
    }

    var releasedAtDate: Date? {
        Self.iso8601Formatter.date(from: releasedAt)
    }

    private static let iso8601Formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    var formattedDuration: String {
        let h = duration / 3600
        let m = (duration % 3600) / 60
        if h > 0 { return "\(h)h \(m)m" }
        return "\(m)m"
    }

    var formattedDate: String {
        guard let date = releasedAtDate else { return "" }
        return Self.displayFormatter.string(from: date)
    }

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    var collectiveName: String {
        switch collectiveSlug {
        case "soulection":          return "Soulection"
        case "sasha-marie-radio":   return "Sasha Marie Radio"
        case "the-love-below-hour": return "The Love Below Hour"
        case "local":               return "Local"
        default:                    return collectiveSlug
        }
    }
}
