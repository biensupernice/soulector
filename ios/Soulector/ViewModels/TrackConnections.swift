import Foundation

// MARK: - Appearance

/// One playing of a track: which episode, and where inside it.
struct TrackAppearance: Identifiable, Hashable {
    let episode: Episode
    let track: EpisodeTrack

    /// Unique across the library — a track is identified by the set it played
    /// in and its slot in that cue sheet.
    var id: String { "\(episode.id)#\(track.order)" }
}

// MARK: - Graph

/// Every cue sheet in the library, grouped by track identity, so a track
/// playing in one set can find the other sets that played it.
///
/// Built from the same `episodes.searchIndex` snapshot that powers search, so
/// the whole graph lives on the device: moving sideways costs no network and
/// works from the cached index on a cold launch.
struct TrackGraph {
    private let appearancesByKey: [String: [TrackAppearance]]
    private let tracksByEpisode: [String: [EpisodeTrack]]

    static let empty = TrackGraph()

    private init() {
        appearancesByKey = [:]
        tracksByEpisode = [:]
    }

    init(index: [SearchIndexEpisode]) {
        var byKey: [String: [TrackAppearance]] = [:]
        var byEpisode: [String: [EpisodeTrack]] = [:]
        byEpisode.reserveCapacity(index.count)

        // The index arrives newest-first, and insertion order is preserved
        // inside each bucket, so every list of appearances is already in the
        // order the app wants to show them.
        for item in index {
            let tracks = item.tracks.sorted { $0.order < $1.order }
            byEpisode[item.episode.id] = tracks
            for track in tracks {
                guard let key = TrackIdentity.key(for: track) else { continue }
                byKey[key, default: []].append(TrackAppearance(episode: item.episode, track: track))
            }
        }

        appearancesByKey = byKey
        tracksByEpisode = byEpisode
    }

    /// The other episodes that played this track, newest first, at most one
    /// entry per episode (a set that spun it twice still shows up once, at the
    /// earlier timestamp).
    func otherAppearances(of track: EpisodeTrack, excluding episodeId: String) -> [TrackAppearance] {
        guard let key = TrackIdentity.key(for: track), let all = appearancesByKey[key] else { return [] }
        var seen: Set<String> = [episodeId]
        return all.filter { seen.insert($0.episode.id).inserted }
    }

    /// How many other episodes played this track — what the sideways badge counts.
    func connectionCount(of track: EpisodeTrack, excluding episodeId: String) -> Int {
        otherAppearances(of: track, excluding: episodeId).count
    }

    /// An episode's tracklist as the index has it. The dive reads cue sheets
    /// out of the snapshot rather than making a request per episode, which is
    /// what keeps a fast dive fast.
    func tracks(forEpisode episodeId: String) -> [EpisodeTrack] {
        tracksByEpisode[episodeId] ?? []
    }
}

// MARK: - Identity

/// Boils a track down to an identity that survives the small differences
/// between how two cue sheets typed the same record: casing, accents,
/// ampersands, and above all guest credits, which are spelled a dozen ways and
/// seldom the same way twice.
///
/// Deliberately *not* fuzzy. A near-match here would wire unrelated sets
/// together, and a wrong connection is worse than a missing one — the whole
/// promise of the feature is "this exact record also played here".
enum TrackIdentity {
    private static let foldingOptions: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]

    /// Words that introduce a guest credit. Everything from the marker on is
    /// noise as far as identity goes.
    private static let featureMarkers: Set<String> = ["feat", "feats", "ft", "fts", "featuring", "w"]

    /// In an artist credit, everything past the first of these is a
    /// collaborator, so the credit is cut down to whoever is named first.
    /// That is what lets "Sango" meet "Sango x Xavier Omär".
    private static let artistSeparators: Set<String> = ["and", "x", "vs", "versus", "with", "plus", "presents"]

    /// Names that identify nothing. Cue sheets are full of these, and left in
    /// they'd collapse into one enormous cluster wiring every set to every
    /// other. Segment markers ("Intro", "Interlude") go in the same bin: they
    /// name a position in a show, not a record.
    private static let placeholderTitles: Set<String> = [
        "id", "ids", "unknown", "untitled", "unreleased", "track", "new",
        "intro", "outro", "interlude", "skit", "na", "tbd",
    ]
    private static let placeholderArtists: Set<String> = [
        "id", "ids", "unknown", "unknown artist", "various", "various artists", "va", "na", "tbd",
    ]

    /// A credit that opens with one of these belongs to a show, not a record —
    /// "Soulection Radio — Hosted by Joe Kay" is a station ident, and it is the
    /// single most repeated line in the whole library. Left in, it would wire a
    /// quarter of the archive into one meaningless cluster.
    private static let hostMarkers: Set<String> = ["hosted", "presented", "vo", "voiceover"]

    /// The identity two tracks have to share to count as the same record, or
    /// nil when the track names nothing worth connecting.
    static func key(for track: EpisodeTrack) -> String? {
        guard let title = titleKey(track.name), let artist = artistKey(track.artist) else { return nil }
        guard let credited = artist.split(separator: " ").first,
              !hostMarkers.contains(String(credited))
        else { return nil }
        // The other shape an ident takes: the credit simply repeats the title
        // ("Soulection Live at the El Rey — Soulection Live at the El Rey").
        // Only in that direction — a title that *starts* with its artist's name
        // is an ordinary record ("Nas Is Like" — Nas).
        guard artist != title, !artist.hasPrefix(title + " ") else { return nil }
        return title + "|" + artist
    }

    /// Title identity: guest credits dropped, everything else kept — a remix
    /// is a different record and has to stay one.
    static func titleKey(_ name: String) -> String? {
        var words: [String] = []
        for segment in segments(of: name) {
            let segmentWords = self.words(segment.text)
            if segment.bracketed {
                // "(feat. Sango)" is a credit; "(Kaytranada Remix)" is the
                // record itself, so only the former goes.
                if let first = segmentWords.first, featureMarkers.contains(first) { continue }
                words += segmentWords
            } else {
                // A bare "feat." runs to the end of its segment, which leaves
                // any following "(Remix)" in place — so both spellings of the
                // same remix land on the same key.
                words += segmentWords.prefix { !featureMarkers.contains($0) }
            }
        }

        let key = words.joined(separator: " ")
        guard key.count >= 2, !placeholderTitles.contains(key) else { return nil }
        return key
    }

    /// Artist identity: whoever is credited first, with the rest of the line
    /// treated as collaborators.
    static func artistKey(_ artist: String) -> String? {
        var words: [String] = []
        for segment in segments(of: artist) {
            // A bracketed aside on an artist ("(Live)", "(UK)") never
            // identifies them.
            guard !segment.bracketed else { continue }
            for word in self.words(segment.text, splitOnCommas: true) {
                if featureMarkers.contains(word) || artistSeparators.contains(word) {
                    return finishedArtistKey(words)
                }
                words.append(word)
            }
        }
        return finishedArtistKey(words)
    }

    private static func finishedArtistKey(_ words: [String]) -> String? {
        let key = words.joined(separator: " ")
        guard key.count >= 2, !placeholderArtists.contains(key) else { return nil }
        return key
    }

    // MARK: Text handling

    /// Folded words. `&` and `+` become "and" so "Me & You" and "Me And You"
    /// land on the same identity; with `splitOnCommas`, list punctuation does
    /// too, which is how an artist credit gets cut at its first name.
    private static func words(_ value: String, splitOnCommas: Bool = false) -> [String] {
        var folded = ""
        for character in value.folding(options: foldingOptions, locale: nil).lowercased() {
            if character.isLetter || character.isNumber {
                folded.append(character)
            } else if character == "&" || character == "+"
                || (splitOnCommas && (character == "," || character == "/" || character == ";" || character == "|")) {
                folded += " and "
            } else {
                folded.append(" ")
            }
        }
        return folded.split(separator: " ").map(String.init)
    }

    /// Splits a name into its plain text and its bracketed asides, in order, so
    /// each can be judged on its own. Nested brackets stay with their group;
    /// an unclosed one runs to the end.
    private static func segments(of value: String) -> [(text: String, bracketed: Bool)] {
        var result: [(text: String, bracketed: Bool)] = []
        var current = ""
        var depth = 0

        for character in value {
            switch character {
            case "(", "[", "{":
                if depth == 0 {
                    if !current.isEmpty { result.append((text: current, bracketed: false)) }
                    current = ""
                } else {
                    current.append(character)
                }
                depth += 1
            case ")", "]", "}":
                if depth > 0 {
                    depth -= 1
                    if depth == 0 {
                        if !current.isEmpty { result.append((text: current, bracketed: true)) }
                        current = ""
                    } else {
                        current.append(character)
                    }
                } else {
                    current.append(character)
                }
            default:
                current.append(character)
            }
        }

        if !current.isEmpty { result.append((text: current, bracketed: depth > 0)) }
        return result
    }
}
