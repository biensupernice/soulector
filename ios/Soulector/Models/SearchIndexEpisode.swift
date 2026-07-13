import Foundation

/// An episode plus its track listing, as returned by `episodes.searchIndex`.
/// The projection is a superset of `episodes.all`, so the episode fields decode
/// straight into `Episode` and we only add the `tracks` array on top.
struct SearchIndexEpisode: Identifiable, Codable {
    let episode: Episode
    let tracks: [EpisodeTrack]

    var id: String { episode.id }

    private enum CodingKeys: String, CodingKey {
        case tracks
    }

    init(from decoder: Decoder) throws {
        episode = try Episode(from: decoder)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        tracks = try container.decodeIfPresent([EpisodeTrack].self, forKey: .tracks) ?? []
    }

    func encode(to encoder: Encoder) throws {
        try episode.encode(to: encoder)
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(tracks, forKey: .tracks)
    }
}
