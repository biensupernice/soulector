import Foundation
import UIKit

/// What the widget shows when it can't read the app's now-playing snapshot —
/// either because the App Group container isn't available to this build's
/// signing, or simply because nothing has played yet.
///
/// The radio schedule is a pure function of (episode set, station, wall clock),
/// so the widget can compute what's on the air on its own, with no shared
/// state, using the very same `RadioSchedule` the app and web use. That keeps
/// the widget useful — and honest about what's broadcasting — in every signing
/// configuration.
enum LiveRadioPreview {

    struct Result {
        let snapshot: NowPlayingSnapshot
        let artwork: UIImage?
        /// When the current broadcast slot ends, so the timeline can refresh
        /// exactly when the episode changes.
        let slotEndsAt: Date
    }

    static func current(collective: String) async -> Result? {
        guard let episodes = await episodeCatalog() else { return nil }

        let pool = episodes
            .filter { collective == "all" || $0.collectiveSlug == collective }
            .filter(\.isStreamable)

        let nowMs = Int(Date().timeIntervalSince1970 * 1000)
        guard
            let slot = RadioSchedule.slotAt(
                episodes: pool,
                stationKey: RadioSchedule.stationKey(collective: collective),
                nowMs: nowMs
            ),
            let episode = pool.first(where: { $0.id == slot.episodeId })
        else { return nil }

        // Accent and artwork are decoration: a failure here still leaves a
        // usable card, so both are best-effort.
        let accent = try? await APIClient.shared.fetchAccentColor(episodeId: episode.id)
        let swatch = accent?.appSwatch
        let artwork = await artworkImage(for: episode)

        let durationMs = max(1, episode.duration * 1000)
        let snapshot = NowPlayingSnapshot(
            hasEpisode: true,
            title: episode.name,
            subtitle: episode.collectiveName,
            // Nothing is actually playing on this device yet — the card is
            // reporting the broadcast, not our own playback.
            isPlaying: false,
            isRadioOn: false,
            elapsedSeconds: Double(slot.offsetMs) / 1000,
            durationSeconds: Double(durationMs) / 1000,
            accentRGB: swatch?.rgb,
            accentHSL: swatch?.hsl,
            collective: collective,
            updatedAt: Date()
        )

        return Result(
            snapshot: snapshot,
            artwork: artwork,
            slotEndsAt: Date(timeIntervalSince1970: Double(slot.endsAtMs) / 1000)
        )
    }

    // MARK: - Episode catalog (widget-local cache)

    /// Widget processes get a tight network budget, and the catalog only
    /// changes on weekly syncs — so serve from a local cache and refresh it in
    /// the background. Lives in the widget's own container, which needs no App
    /// Group, so the fallback works even when the shared container doesn't.
    private static let cacheTTL: TimeInterval = 6 * 60 * 60

    private static var cacheURL: URL? {
        FileManager.default
            .urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("widget_episodes_cache.json")
    }

    private static func episodeCatalog() async -> [Episode]? {
        if let cached = readCache(), !cached.isStale {
            return cached.episodes
        }
        if let fetched = try? await APIClient.shared.fetchEpisodes() {
            writeCache(fetched)
            return fetched
        }
        // Network failed — a stale catalog still schedules a sensible slot.
        return readCache()?.episodes
    }

    private struct Cache: Codable {
        let episodes: [Episode]
        let savedAt: Date
        var isStale: Bool { Date().timeIntervalSince(savedAt) > cacheTTL }
    }

    private static func readCache() -> Cache? {
        guard let url = cacheURL,
              let data = try? Data(contentsOf: url),
              let cache = try? JSONDecoder().decode(Cache.self, from: data)
        else { return nil }
        return cache
    }

    private static func writeCache(_ episodes: [Episode]) {
        guard let url = cacheURL,
              let data = try? JSONEncoder().encode(Cache(episodes: episodes, savedAt: Date()))
        else { return }
        try? data.write(to: url, options: .atomic)
    }

    // MARK: - Artwork

    private static func artworkImage(for episode: Episode) async -> UIImage? {
        guard let url = URL(string: episode.artworkUrl),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let image = UIImage(data: data)
        else { return nil }
        return image
    }
}
