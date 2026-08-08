import { useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { trpc } from "@/utils/trpc";
import { EpisodeSearchProjection } from "@/server/router";

export type SearchIndexEpisode = EpisodeSearchProjection;

// Bump the version suffix whenever the shape of the cached payload changes so
// stale snapshots from older clients are ignored.
const CACHE_KEY = "soulector:search-index:v1";

/**
 * The snapshot is one thing, so it is read and written once.
 *
 * Several surfaces ask for it — the screen itself, the track graph, the
 * connections list — and each used to open its own copy: reading 20k cue-sheet
 * rows back out of IndexedDB costs ~300ms of structured clone, and writing them
 * back costs ~350ms more. Opening a set mounts three of those askers, so a tap
 * paid for six trips through a snapshot that had not changed. Hoisting both
 * sides out of the hook makes the read happen once per session and the write
 * once per payload, however many callers there are.
 */
let pendingRead: Promise<SearchIndexEpisode[] | undefined> | null = null;

function readPersisted() {
  if (!pendingRead) {
    // IndexedDB may be unavailable (private mode, etc.) — fall back to network.
    pendingRead = get<SearchIndexEpisode[]>(CACHE_KEY).catch(() => undefined);
  }
  return pendingRead;
}

let persisted: SearchIndexEpisode[] | null = null;

function persist(index: SearchIndexEpisode[]) {
  if (persisted === index) {
    return;
  }
  persisted = index;
  set(CACHE_KEY, index).catch(() => {
    // Ignore persistence failures; in-memory data still works this session.
  });
}

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
    readPersisted().then((value) => {
      if (active && value) {
        setCached(value);
      }
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
      persist(fresh);
    }
  }, [fresh]);

  return fresh ?? cached;
}
