import { useDeferredValue, useMemo } from "react";
import { trackKey } from "@/lib/trackIdentity";
import { EpisodeProjection, EpisodeTrackProjection } from "@/server/router";
import { SearchIndexEpisode, useSearchIndex } from "./useSearchIndex";

/** One playing of a record: which set, and where inside it. */
export type TrackAppearance = {
  episode: EpisodeProjection;
  track: EpisodeTrackProjection;
};

export type TrackGraph = {
  /**
   * The other episodes that played this track, newest first, at most one entry
   * per episode (a set that spun it twice shows up once, at the earlier slot).
   */
  connectionsFor: (episodeId: string, order: number) => TrackAppearance[];
  connectionCountFor: (episodeId: string, order: number) => number;
  /** Null until the search index has loaded. */
  ready: boolean;
};

const EMPTY: TrackAppearance[] = [];

/**
 * Every cue sheet in the library, grouped by track identity, so a record
 * playing in one set can find the other sets that played it.
 *
 * Built from the same `episodes.searchIndex` snapshot that powers search — the
 * whole graph is already on the client, so moving sideways costs no network
 * and works from the cached index on a cold start.
 */
export function useTrackGraph(): TrackGraph {
  const index = useSearchIndex();
  // Bucketing 20k cue-sheet rows costs a couple of hundred milliseconds, which
  // is too long to spend in a blocking render. Deferring lets the list paint
  // first and the graph land when it lands — the badges simply appear a beat
  // later, which is what the iOS app gets from building off the main actor.
  const deferredIndex = useDeferredValue(index);

  return useMemo(() => buildTrackGraph(deferredIndex), [deferredIndex]);
}

export function buildTrackGraph(
  index: SearchIndexEpisode[] | null,
): TrackGraph {
  if (!index) {
    return {
      connectionsFor: () => EMPTY,
      connectionCountFor: () => 0,
      ready: false,
    };
  }

  const appearancesByKey = new Map<string, TrackAppearance[]>();
  // Saves re-keying a track every time a row asks for its badge count.
  const keyByTrack = new Map<string, string>();

  // The index arrives newest-first and insertion order is preserved inside
  // each bucket, so every list of appearances is already in the order we want
  // to show it.
  for (const { tracks, ...episode } of index) {
    for (const track of tracks) {
      const key = trackKey(track.name, track.artist);
      if (key === null) continue;

      keyByTrack.set(trackSlot(episode.id, track.order), key);

      const bucket = appearancesByKey.get(key);
      const appearance = { episode, track };
      if (bucket) {
        bucket.push(appearance);
      } else {
        appearancesByKey.set(key, [appearance]);
      }
    }
  }

  function connectionsFor(episodeId: string, order: number): TrackAppearance[] {
    const key = keyByTrack.get(trackSlot(episodeId, order));
    if (key === undefined) return EMPTY;

    const seen = new Set<string>([episodeId]);
    const connections: TrackAppearance[] = [];
    for (const appearance of appearancesByKey.get(key) ?? EMPTY) {
      if (seen.has(appearance.episode.id)) continue;
      seen.add(appearance.episode.id);
      connections.push(appearance);
    }
    return connections;
  }

  return {
    connectionsFor,
    connectionCountFor: (episodeId, order) =>
      connectionsFor(episodeId, order).length,
    ready: true,
  };
}

function trackSlot(episodeId: string, order: number) {
  return `${episodeId}:${order}`;
}
