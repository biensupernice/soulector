/**
 * Deterministic "radio" schedule.
 *
 * Radio mode simulates a shared live broadcast without any server-side state,
 * which keeps it compatible with the serverless deployment: what's "on the
 * air" is a pure function of (episode set, station key, wall-clock time), so
 * every client that tunes in computes the same episode and offset.
 *
 * How it works:
 * - Episodes are arranged into a ring in a pseudo-random but deterministic
 *   order, by sorting on a hash of the episode id salted with the station
 *   key. Hash-ordering (rather than a seeded Fisher-Yates shuffle) means a
 *   newly synced episode inserts into one spot in the ring instead of
 *   reshuffling everything.
 * - The broadcast conceptually started at RADIO_EPOCH_MS and has been playing
 *   the ring on repeat ever since. Total ring length is the sum of episode
 *   durations — with hundreds of multi-hour episodes a full cycle spans years.
 * - The current slot is found by taking the elapsed time since the epoch
 *   modulo the ring length and walking cumulative durations.
 *
 * Tradeoff: when the episode set changes (weekly syncs) the ring length
 * changes, so the modulo arithmetic lands somewhere new and the "broadcast"
 * jumps. Listeners mid-episode aren't interrupted — clients only re-evaluate
 * the schedule at slot boundaries.
 */

export type RadioEpisodeInput = {
  id: string;
  /** Episode length in seconds (as stored on episode projections). */
  duration: number;
};

export type RadioSlot = {
  episodeId: string;
  /** How far into the episode the broadcast currently is. */
  offsetMs: number;
  /** Wall-clock time this episode's slot started. */
  startsAtMs: number;
  /** Wall-clock time this episode's slot ends and the next one begins. */
  endsAtMs: number;
};

/** The moment the imaginary broadcast went on the air. */
export const RADIO_EPOCH_MS = Date.UTC(2020, 0, 1);

export function radioStationKey(collective: string) {
  return `soulector-radio:v1:${collective}`;
}

/** FNV-1a 32-bit — small, stable, and plenty for ordering a playlist. */
export function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The station's ring order: deterministic, pseudo-random per station key. */
export function radioOrdering<T extends RadioEpisodeInput>(
  episodes: T[],
  stationKey: string,
): T[] {
  return [...episodes].sort((a, b) => {
    const ha = hash32(`${stationKey}:${a.id}`);
    const hb = hash32(`${stationKey}:${b.id}`);
    if (ha !== hb) return ha - hb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * What the station is broadcasting at `nowMs`, or null when there's nothing
 * playable to schedule.
 */
export function radioSlotAt(
  episodes: RadioEpisodeInput[],
  stationKey: string,
  nowMs: number,
): RadioSlot | null {
  const pool = episodes.filter((e) => e.duration > 0);
  if (pool.length === 0) {
    return null;
  }

  const ordered = radioOrdering(pool, stationKey);
  const totalMs = ordered.reduce((sum, e) => sum + e.duration * 1000, 0);

  const elapsedMs = nowMs - RADIO_EPOCH_MS;
  const posMs = ((elapsedMs % totalMs) + totalMs) % totalMs;
  const cycleStartMs = nowMs - posMs;

  let accMs = 0;
  for (const episode of ordered) {
    const durationMs = episode.duration * 1000;
    if (posMs < accMs + durationMs) {
      return {
        episodeId: episode.id,
        offsetMs: posMs - accMs,
        startsAtMs: cycleStartMs + accMs,
        endsAtMs: cycleStartMs + accMs + durationMs,
      };
    }
    accMs += durationMs;
  }

  // Unreachable: posMs < totalMs by construction. Keeps TS happy.
  return null;
}
