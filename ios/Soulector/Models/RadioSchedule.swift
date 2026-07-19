import Foundation

/// Deterministic "radio" schedule — the Swift port of the web module
/// (`src/lib/radioSchedule.ts`).
///
/// Radio mode simulates a shared live broadcast without any server-side state:
/// what's "on the air" is a pure function of (episode set, station key,
/// wall-clock time), so every client that tunes in computes the same episode
/// and offset. Because iOS and web fetch the same `episodes.all` catalog, a
/// phone and a browser tuned to the same station hear the same thing — but
/// only as long as this file mirrors the TypeScript implementation exactly
/// (same hash, same ordering, same epoch). Change them together or not at all.
///
/// How it works:
/// - Episodes are arranged into a ring in a pseudo-random but deterministic
///   order, by sorting on a hash of the episode id salted with the station
///   key. Hash-ordering (rather than a seeded shuffle) means a newly synced
///   episode inserts into one spot in the ring instead of reshuffling
///   everything.
/// - The broadcast conceptually started at `epochMs` and has been playing the
///   ring on repeat ever since. The current slot is found by taking the
///   elapsed time since the epoch modulo the ring length and walking
///   cumulative durations.
///
/// Tradeoff: when the episode set changes (weekly syncs) the ring length
/// changes, so the modulo arithmetic lands somewhere new and the "broadcast"
/// jumps. Listeners mid-episode aren't interrupted — clients only re-evaluate
/// the schedule at slot boundaries. For the same reason the shared broadcast
/// is best-effort: two clients only agree while they hold the same episode
/// list.

struct RadioSlot: Equatable {
    let episodeId: String
    /// How far into the episode the broadcast currently is.
    let offsetMs: Int
    /// Wall-clock time (ms since the Unix epoch) this episode's slot started.
    let startsAtMs: Int
    /// Wall-clock time this episode's slot ends and the next one begins.
    let endsAtMs: Int
}

enum RadioSchedule {
    /// The moment the imaginary broadcast went on the air: 2020-01-01T00:00Z,
    /// in ms since the Unix epoch. Must equal the web's `RADIO_EPOCH_MS`.
    static let epochMs = 1_577_836_800_000

    static func stationKey(collective: String) -> String {
        "soulector-radio:v1:\(collective)"
    }

    /// FNV-1a 32-bit with a murmur3-style finalizer.
    ///
    /// Iterates UTF-16 code units to match the web's `charCodeAt` loop, and
    /// `&*` keeps the low 32 bits of each product exactly like JS `Math.imul`,
    /// so both platforms hash every key to the same value.
    ///
    /// FNV-1a alone has weak avalanche on trailing-character differences, and
    /// Mongo ObjectIds minted in the same sync batch differ mainly in their
    /// trailing counter — without further mixing, a week's episodes cluster
    /// into near-consecutive ring positions. The finalizer scatters them.
    static func hash32(_ str: String) -> UInt32 {
        var h: UInt32 = 0x811c9dc5
        for unit in str.utf16 {
            h ^= UInt32(unit)
            h = h &* 0x01000193
        }
        h ^= h >> 16
        h = h &* 0x85ebca6b
        h ^= h >> 13
        h = h &* 0xc2b2ae35
        h ^= h >> 16
        return h
    }

    /// The station's ring order: deterministic, pseudo-random per station key.
    static func ordering(_ episodes: [Episode], stationKey: String) -> [Episode] {
        let keyed = episodes.map { episode in
            (hash: hash32("\(stationKey):\(episode.id)"), episode: episode)
        }
        return keyed
            .sorted { a, b in
                if a.hash != b.hash { return a.hash < b.hash }
                return a.episode.id < b.episode.id
            }
            .map { $0.episode }
    }

    /// What the station is broadcasting at `nowMs`, or nil when there's
    /// nothing playable to schedule.
    static func slotAt(episodes: [Episode], stationKey: String, nowMs: Int) -> RadioSlot? {
        let pool = episodes.filter { $0.duration > 0 }
        guard !pool.isEmpty else { return nil }

        let ordered = ordering(pool, stationKey: stationKey)
        let totalMs = ordered.reduce(0) { $0 + $1.duration * 1000 }

        let elapsedMs = nowMs - epochMs
        let posMs = ((elapsedMs % totalMs) + totalMs) % totalMs
        let cycleStartMs = nowMs - posMs

        var accMs = 0
        for episode in ordered {
            let durationMs = episode.duration * 1000
            if posMs < accMs + durationMs {
                return RadioSlot(
                    episodeId: episode.id,
                    offsetMs: posMs - accMs,
                    startsAtMs: cycleStartMs + accMs,
                    endsAtMs: cycleStartMs + accMs + durationMs
                )
            }
            accMs += durationMs
        }

        // Unreachable: posMs < totalMs by construction.
        return nil
    }
}
