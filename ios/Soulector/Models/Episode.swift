import Foundation

/// Collectives the app no longer surfaces.
///
/// The Love Below Hour deleted 133 of its 134 episodes from SoundCloud in 2026.
/// The API stopped serving them, so anything still offering the collective can
/// only lead somewhere empty.
///
/// This lives beside `Episode` rather than beside `CollectiveFilter` because
/// `Episode` is compiled into the widget target too, and the view models are
/// not. `CollectiveFilter.isHidden` reads from here so there is one list.
enum HiddenCollectives {
    static let slugs: Set<String> = ["the-love-below-hour"]
}

struct Episode: Identifiable, Equatable, Hashable, Codable {
    let id: String
    let source: String
    let duration: Int // seconds
    let releasedAt: String
    let name: String
    let permalinkUrl: String
    let collectiveSlug: String
    let artworkUrl: String
    /// Whether `episode.getStreamUrl` can return audio for this episode
    /// (MIXCLOUD episodes are only playable through an archive mirror).
    /// Optional because cached payloads may predate the field.
    let hasStreamableAudio: Bool?

    // Note: JSON also contains "createadAt" (typo) and "embedPlayerKey" (Int or String),
    // both are intentionally omitted from CodingKeys so they are silently ignored.
    private enum CodingKeys: String, CodingKey {
        case id, source, duration, releasedAt, name, permalinkUrl, collectiveSlug, artworkUrl
        case hasStreamableAudio
    }

    /// Radio mode keeps unplayable episodes out of the broadcast schedule.
    /// A stale cache without the flag falls back to excluding all MIXCLOUD
    /// episodes — too strict for archive-mirrored ones, but only until the
    /// next `episodes.all` refresh replaces the cache.
    var isStreamable: Bool {
        hasStreamableAudio ?? (source != "MIXCLOUD")
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
        let cal = Calendar.current
        let day = cal.component(.day, from: date)
        let year = cal.component(.year, from: date)
        let month = Self.monthFormatter.string(from: date)
        let ordinal = Self.ordinalFormatter.string(from: NSNumber(value: day)) ?? "\(day)"
        return "\(month) \(ordinal) \(year)"
    }

    private static let monthFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMMM"
        return f
    }()

    private static let ordinalFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .ordinal
        return f
    }()

    /// True for an episode whose collective the app no longer surfaces. Only
    /// reachable from a device cache written before the collective was hidden.
    var isFromHiddenCollective: Bool {
        HiddenCollectives.slugs.contains(collectiveSlug)
    }

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
