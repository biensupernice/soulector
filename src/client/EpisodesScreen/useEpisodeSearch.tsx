import { useMemo } from "react";
import Fuse from "fuse.js";
import {
  EpisodeSearchProjection,
  EpisodeTrackProjection,
  EpisodeCollectiveSlugProjection,
} from "@/server/router";

export type SearchResult = {
  episode: EpisodeSearchProjection;
  /** Whether the episode title itself matched the query. */
  episodeTitleMatch: boolean;
  /** Fuse score of the title match (0 = perfect), when the title matched. */
  episodeTitleScore?: number;
  /** Tracks within this episode that matched the query. */
  matchedTracks: EpisodeTrackProjection[];
  /** Best (lowest) Fuse score across the title/track matches. 0 = perfect. */
  score: number;
};

type TrackEntry = {
  episode: EpisodeSearchProjection;
  track: EpisodeTrackProjection;
  /** name + artist, so a query spanning both fields can match in one place. */
  combined: string;
};

const EPISODE_FUSE_OPTIONS: Fuse.IFuseOptions<EpisodeSearchProjection> = {
  keys: ["name"],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
  useExtendedSearch: true,
};

const TRACK_FUSE_OPTIONS: Fuse.IFuseOptions<TrackEntry> = {
  keys: [
    { name: "track.name", weight: 2 },
    { name: "track.artist", weight: 1 },
    { name: "combined", weight: 2 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
  useExtendedSearch: true,
};

const MAX_RESULTS = 100;

/**
 * Turns a raw query into a Fuse extended-search pattern that ANDs each word as a
 * fuzzy term. Punctuation (dashes, ampersands, etc.) is dropped so a query like
 * "Missing You - Sharon & Marva" becomes `missing you sharon marva`, matching
 * regardless of word order or separators and across the name/artist fields.
 */
function toExtendedQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .join(" ");
}

/**
 * Fuzzy search over episodes and their tracks, returning results grouped by
 * episode. A result is included when the episode title matches and/or one or
 * more of its tracks match; matching tracks are surfaced within their episode
 * context so they can be played at the right timestamp.
 */
export function useEpisodeSearch(
  index: EpisodeSearchProjection[] | null,
  query: string,
  collective: "all" | EpisodeCollectiveSlugProjection,
): SearchResult[] {
  const scopedIndex = useMemo(() => {
    if (!index) return [];
    if (collective === "all") return index;
    return index.filter((e) => e.collectiveSlug === collective);
  }, [index, collective]);

  const { episodeFuse, trackFuse } = useMemo(() => {
    const trackEntries: TrackEntry[] = [];
    for (const episode of scopedIndex) {
      for (const track of episode.tracks) {
        trackEntries.push({
          episode,
          track,
          combined: `${track.name} ${track.artist}`,
        });
      }
    }

    return {
      episodeFuse: new Fuse(scopedIndex, EPISODE_FUSE_OPTIONS),
      trackFuse: new Fuse(trackEntries, TRACK_FUSE_OPTIONS),
    };
  }, [scopedIndex]);

  return useMemo(() => {
    const pattern = toExtendedQuery(query);
    if (!pattern) return [];

    const byEpisodeId = new Map<string, SearchResult>();

    for (const { item, score = 1 } of episodeFuse.search(pattern)) {
      byEpisodeId.set(item.id, {
        episode: item,
        episodeTitleMatch: true,
        episodeTitleScore: score,
        matchedTracks: [],
        score,
      });
    }

    for (const { item, score = 1 } of trackFuse.search(pattern)) {
      const existing = byEpisodeId.get(item.episode.id);
      if (existing) {
        existing.matchedTracks.push(item.track);
        existing.score = Math.min(existing.score, score);
      } else {
        byEpisodeId.set(item.episode.id, {
          episode: item.episode,
          episodeTitleMatch: false,
          matchedTracks: [item.track],
          score,
        });
      }
    }

    const results = Array.from(byEpisodeId.values());

    for (const result of results) {
      result.matchedTracks.sort((a, b) => a.order - b.order);
    }

    // Episodes whose title matches rank first (sorted by how well the title
    // matched), followed by episodes matched only via their tracks (sorted by
    // track score). This surfaces the episode itself ahead of episodes that
    // merely contain a matching track.
    results.sort((a, b) => {
      if (a.episodeTitleMatch !== b.episodeTitleMatch) {
        return a.episodeTitleMatch ? -1 : 1;
      }
      if (a.episodeTitleMatch && b.episodeTitleMatch) {
        return (a.episodeTitleScore ?? 1) - (b.episodeTitleScore ?? 1);
      }
      return a.score - b.score;
    });

    return results.slice(0, MAX_RESULTS);
  }, [query, episodeFuse, trackFuse]);
}
