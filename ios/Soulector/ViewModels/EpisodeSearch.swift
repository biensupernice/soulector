import Foundation

/// A single search result: an episode plus whichever of its tracks matched.
struct EpisodeSearchResult: Identifiable {
    let episode: Episode
    /// Whether the episode title itself matched the query.
    let episodeTitleMatch: Bool
    /// Matching tracks within this episode, sorted by order.
    let matchedTracks: [EpisodeTrack]

    var id: String { episode.id }
}

/// Client-side search over episodes and their tracks. This ports the spirit of
/// the web app's Fuse.js extended search: the query is split into tokens and a
/// target matches only when it contains ALL of them (order-independent,
/// case- and diacritic-insensitive), which mirrors the web's AND-of-terms.
enum EpisodeSearch {
    private static let foldingOptions: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]
    private static let maxResults = 100

    /// Lowercase, replace non-alphanumerics with spaces, split, drop tokens < 2 chars.
    static func tokenize(_ query: String) -> [String] {
        let cleaned = query.folding(options: foldingOptions, locale: nil)
            .map { $0.isLetter || $0.isNumber ? $0 : " " }
        return String(cleaned)
            .split(separator: " ")
            .map(String.init)
            .filter { $0.count >= 2 }
    }

    private static func matches(_ target: String, tokens: [String]) -> Bool {
        let folded = target.folding(options: foldingOptions, locale: nil)
        return tokens.allSatisfy { folded.contains($0) }
    }

    /// Groups matches by episode and ranks title matches ahead of track-only
    /// matches, preserving the index's release-date order within each group.
    static func search(
        index: [SearchIndexEpisode],
        query: String,
        collective: CollectiveFilter
    ) -> [EpisodeSearchResult] {
        let tokens = tokenize(query)
        guard !tokens.isEmpty else { return [] }

        let scoped = collective == .all
            ? index
            : index.filter { $0.episode.collectiveSlug == collective.rawValue }

        var titled: [EpisodeSearchResult] = []
        var trackOnly: [EpisodeSearchResult] = []

        for item in scoped {
            let titleMatch = matches(item.episode.name, tokens: tokens)
            let matchedTracks = item.tracks
                .filter { matches("\($0.name) \($0.artist)", tokens: tokens) }
                .sorted { $0.order < $1.order }

            guard titleMatch || !matchedTracks.isEmpty else { continue }

            let result = EpisodeSearchResult(
                episode: item.episode,
                episodeTitleMatch: titleMatch,
                matchedTracks: matchedTracks
            )
            if titleMatch {
                titled.append(result)
            } else {
                trackOnly.append(result)
            }
        }

        return Array((titled + trackOnly).prefix(maxResults))
    }
}
