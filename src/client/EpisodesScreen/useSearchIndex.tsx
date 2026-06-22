import { useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { trpc } from "@/utils/trpc";
import { EpisodeSearchProjection } from "@/server/router";

export type SearchIndexEpisode = EpisodeSearchProjection;

// Bump the version suffix whenever the shape of the cached payload changes so
// stale snapshots from older clients are ignored.
const CACHE_KEY = "soulector:search-index:v1";

/**
 * Returns the full set of episodes (across all collectives) together with their
 * track listings, used to build the client-side fuzzy search index.
 *
 * The snapshot is cached in IndexedDB so search is available instantly on
 * revisit (and offline), while a fresh copy is fetched in the background and
 * written back as the API syncs new episodes/tracks.
 */
export function useSearchIndex(): SearchIndexEpisode[] | null {
  const [cached, setCached] = useState<SearchIndexEpisode[] | null>(null);

  // Load the last persisted snapshot for an instant first paint.
  useEffect(() => {
    let active = true;
    get<SearchIndexEpisode[]>(CACHE_KEY)
      .then((value) => {
        if (active && value) {
          setCached(value);
        }
      })
      .catch(() => {
        // IndexedDB may be unavailable (private mode, etc.) — fall back to network.
      });
    return () => {
      active = false;
    };
  }, []);

  const { data: fresh } = trpc["episodes.searchIndex"].useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Persist freshly synced data back to IndexedDB.
  useEffect(() => {
    if (fresh) {
      set(CACHE_KEY, fresh).catch(() => {
        // Ignore persistence failures; in-memory data still works this session.
      });
    }
  }, [fresh]);

  return fresh ?? cached;
}
