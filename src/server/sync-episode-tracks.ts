import { Db, WithId } from "mongodb";
import { DBEpisode } from "./router";
import { updateEpisodeDetails } from "./update-episode-details";
import { EpisodeTracksSyncSummary } from "./sync-runs";

/**
 * Server-side port of scripts/fetch-soulection-episode-tracks.mjs +
 * scripts/import-episode-tracks.mjs: find Soulection episodes without a
 * tracklist, pull theirs from radio.soulection.com, and write them in.
 *
 * Soulection only — the other collectives have no tracklist source.
 */

// Public anon credentials, read out of radio.soulection.com's client bundle.
// Same pair the local script uses.
const SUPABASE_URL = "https://mojyoxufjnftdfqhdtsm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vanlveHVmam5mdGRmcWhkdHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxMzQwMTEsImV4cCI6MjA1MDcxMDAxMX0.dCFeHmcB_de1cBl62qdBY1V1wHJpi9ETwvjj1FjpiG8";

/**
 * radio.soulection.com only carries tracklists from around here on, so older
 * episodes are permanently "missing" and would otherwise be retried forever.
 */
export const DEFAULT_START_EPISODE = 650;

/**
 * Each episode costs a round trip to Supabase, so a run takes a bite rather
 * than the whole backlog and stays well inside a serverless request budget.
 */
export const DEFAULT_BATCH_LIMIT = 25;

export function extractShowNumber(title: string): number | null {
  const match = title.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Zero-pads each component, so "1:02:3" becomes "01:02:03". */
function normalizeTimestamp(ts?: string | null): string | undefined {
  if (!ts) return undefined;
  const parts = ts.split(":");
  if (parts.length !== 3) return undefined;
  const [h, m, s] = parts.map((p) => p.trim().padStart(2, "0"));
  return `${h}:${m}:${s}`;
}

async function supabaseFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase HTTP ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

type SupabaseEpisode = { id: string; title: string };
type SupabaseEpisodeSong = {
  timestamp: string | null;
  songs: { title: string | null; artists: { name: string } | null } | null;
};

export type EpisodeMissingTracks = {
  episode: WithId<DBEpisode>;
  showNumber: number;
};

/**
 * Soulection episodes at or after `startEpisode` that have no tracklist yet,
 * newest first — the same order the admin screen lists them in.
 */
export async function findSoulectionEpisodesMissingTracks(
  db: Db,
  startEpisode = DEFAULT_START_EPISODE,
): Promise<EpisodeMissingTracks[]> {
  const episodes = await db
    .collection<DBEpisode>("tracksOld")
    .find({
      collective_slug: "soulection",
      $or: [{ tracks: { $exists: false } }, { tracks: { $size: 0 } }],
    })
    .sort({ created_time: -1 })
    .toArray();

  return episodes.flatMap((episode) => {
    const showNumber = extractShowNumber(episode.name);
    if (showNumber === null || showNumber < startEpisode) return [];
    return [{ episode, showNumber }];
  });
}

export type SyncEpisodeTracksOptions = {
  startEpisode?: number;
  limit?: number;
};

export async function syncSoulectionEpisodeTracks(
  db: Db,
  options: SyncEpisodeTracksOptions = {},
): Promise<EpisodeTracksSyncSummary> {
  const startEpisode = options.startEpisode ?? DEFAULT_START_EPISODE;
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;

  const missing = await findSoulectionEpisodesMissingTracks(db, startEpisode);
  const batch = missing.slice(0, limit);

  const skipped: EpisodeTracksSyncSummary["skipped"] = [];
  let episodesUpdated = 0;
  let tracksImported = 0;

  if (batch.length === 0) {
    return {
      kind: "episode-tracks",
      episodesConsidered: 0,
      episodesUpdated: 0,
      tracksImported: 0,
      remaining: 0,
      skipped,
    };
  }

  const supabaseEpisodes = await supabaseFetch<SupabaseEpisode[]>(
    "episodes?select=id,title&order=title&limit=1000",
  );
  const sourceByShowNumber = new Map<number, SupabaseEpisode>();
  for (const sourceEpisode of supabaseEpisodes) {
    const showNumber = extractShowNumber(sourceEpisode.title);
    if (showNumber !== null) sourceByShowNumber.set(showNumber, sourceEpisode);
  }

  for (const { episode, showNumber } of batch) {
    const source = sourceByShowNumber.get(showNumber);
    if (!source) {
      skipped.push({
        episodeName: episode.name,
        reason: "not on radio.soulection.com",
      });
      continue;
    }

    const rows = await supabaseFetch<SupabaseEpisodeSong[]>(
      `episode_songs?episode_id=eq.${source.id}` +
        `&select=timestamp,songs(title,artists(name))` +
        `&order=timestamp`,
    );

    const tracks = rows
      .filter((row) => row.songs?.title?.trim())
      .map((row, i) => ({
        order: i + 1,
        name: row.songs!.title!,
        artist: row.songs?.artists?.name ?? "Unknown Artist",
        timestamp: normalizeTimestamp(row.timestamp),
      }));

    if (tracks.length === 0) {
      skipped.push({
        episodeName: episode.name,
        reason: "no tracks on radio.soulection.com",
      });
      continue;
    }

    await updateEpisodeDetails(db, episode, { tracks });
    episodesUpdated++;
    tracksImported += tracks.length;
  }

  return {
    kind: "episode-tracks",
    episodesConsidered: batch.length,
    episodesUpdated,
    tracksImported,
    remaining: missing.length - episodesUpdated,
    skipped,
  };
}
