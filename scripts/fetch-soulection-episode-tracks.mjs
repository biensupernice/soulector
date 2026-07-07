#!/usr/bin/env node
/**
 * Fetches Soulection episode tracklists from radio.soulection.com (Supabase)
 * for episodes that don't yet have tracks in the soulector database.
 *
 * Usage:
 *   node scripts/fetch-soulection-episode-tracks.mjs [start_episode]
 *
 * Outputs:
 *   data/soulection-episode-tracks.json
 *
 * Environment:
 *   SOULECTOR_BASE_URL  defaults to https://soulector.app
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SOULECTOR_BASE_URL = process.env.SOULECTOR_BASE_URL ?? "https://soulector.app";
const START_EPISODE = parseInt(process.argv[2] ?? "650", 10);

// Public anon credentials from radio.soulection.com's client-side bundle
const SUPABASE_URL = "https://mojyoxufjnftdfqhdtsm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vanlveHVmam5mdGRmcWhkdHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxMzQwMTEsImV4cCI6MjA1MDcxMDAxMX0.dCFeHmcB_de1cBl62qdBY1V1wHJpi9ETwvjj1FjpiG8";

function normalizeTimestamp(ts) {
  if (!ts) return undefined;
  // Ensure each component is zero-padded to 2 digits: "1:02:3" → "01:02:03"
  const parts = ts.split(":");
  if (parts.length !== 3) return undefined;
  const [h, m, s] = parts.map((p) => p.trim().padStart(2, "0"));
  return `${h}:${m}:${s}`;
}

async function supabaseFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${path}`);
  return res.json();
}

async function soulectorFetch(path) {
  const res = await fetch(`${SOULECTOR_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Soulector HTTP ${res.status}: ${path}`);
  return res.json();
}

function extractShowNumber(title) {
  const match = title.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  // ── 1. Load soulector episodes 650+ ────────────────────────────────────────
  console.log(`Fetching soulector episodes #${START_EPISODE}+ ...`);
  const encodedInput = encodeURIComponent(JSON.stringify({ collective: "soulection" }));
  const soulectorRes = await soulectorFetch(
    `/api/trpc/episodes.all?input=${encodedInput}`
  );
  const allSoulectorEps = soulectorRes.result.data;

  const soulectorEps = allSoulectorEps
    .map((ep) => ({ ...ep, showNumber: extractShowNumber(ep.name) }))
    .filter((ep) => ep.showNumber !== null && ep.showNumber >= START_EPISODE)
    .sort((a, b) => a.showNumber - b.showNumber);

  console.log(`  Found ${soulectorEps.length} soulector episodes\n`);

  // ── 2. Find which episodes already have tracks ──────────────────────────────
  console.log("Checking which episodes already have tracks in soulector...");
  const episodesMissingTracks = [];
  for (const ep of soulectorEps) {
    const tracksInput = encodeURIComponent(JSON.stringify({ episodeId: ep.id }));
    const tracksRes = await soulectorFetch(
      `/api/trpc/episode.getTracks?input=${tracksInput}`
    );
    const tracks = tracksRes.result.data;
    if (tracks.length === 0) {
      episodesMissingTracks.push(ep);
    } else {
      console.log(`  Show #${ep.showNumber} — already has ${tracks.length} tracks, skipping`);
    }
  }
  console.log(
    `\n  ${episodesMissingTracks.length} episodes are missing tracks\n`
  );

  if (episodesMissingTracks.length === 0) {
    console.log("Nothing to fetch. All episodes 650+ already have tracks.");
    return;
  }

  // ── 3. Load all episodes from Supabase, index by show number ───────────────
  console.log("Fetching episode list from radio.soulection.com ...");
  const supabaseEps = await supabaseFetch(
    "episodes?select=id,title&order=title&limit=1000"
  );
  const supabaseByShowNumber = new Map();
  for (const ep of supabaseEps) {
    const num = extractShowNumber(ep.title);
    if (num !== null) supabaseByShowNumber.set(num, ep);
  }
  console.log(
    `  Found ${supabaseByShowNumber.size} episodes in radio.soulection.com\n`
  );

  // ── 4. Fetch tracklists from Supabase for episodes missing in soulector ─────
  const results = [];
  for (const ep of episodesMissingTracks) {
    const supabaseEp = supabaseByShowNumber.get(ep.showNumber);
    if (!supabaseEp) {
      console.log(
        `  Show #${ep.showNumber} — not found in radio.soulection.com, skipping`
      );
      continue;
    }

    process.stdout.write(`  Show #${ep.showNumber} — fetching tracklist... `);

    const rows = await supabaseFetch(
      `episode_songs?episode_id=eq.${supabaseEp.id}` +
        `&select=timestamp,songs(title,artists(name))` +
        `&order=timestamp`
    );

    if (rows.length === 0) {
      process.stdout.write(`no tracks in radio.soulection.com\n`);
      continue;
    }

    const tracks = rows
      .filter((row) => row.songs.title?.trim())
      .map((row, i) => ({
        order: i + 1,
        name: row.songs.title,
        artist: row.songs.artists?.name ?? "Unknown Artist",
        timestamp: normalizeTimestamp(row.timestamp),
      }));

    process.stdout.write(`${tracks.length} tracks\n`);
    results.push({
      showNumber: ep.showNumber,
      soulectorEpisodeName: ep.name,
      soulectorPermalinkUrl: ep.permalinkUrl,
      tracks,
    });
  }

  // ── 5. Write output ─────────────────────────────────────────────────────────
  const output = {
    fetchedAt: new Date().toISOString(),
    source: "https://radio.soulection.com",
    startEpisode: START_EPISODE,
    totalEpisodesFetched: results.length,
    episodes: results,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  const outputPath = join(ROOT, "data", "soulection-episode-tracks.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${results.length} episodes with tracks → data/soulection-episode-tracks.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
