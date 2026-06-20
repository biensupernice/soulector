#!/usr/bin/env node
/**
 * Fetches Soulection episodes from soulector.app and saves structured JSON.
 *
 * Usage:
 *   node scripts/fetch-soulection-episodes.mjs [start_episode]
 *
 * Outputs:
 *   data/soulection-episodes.json
 *
 * Environment:
 *   SOULECTOR_BASE_URL  defaults to https://soulector.app
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BASE_URL = process.env.SOULECTOR_BASE_URL ?? "https://soulector.app";
const START_EPISODE = parseInt(process.argv[2] ?? "650", 10);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

function extractShowNumber(name) {
  const match = name.match(/Show #(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  console.log(`Fetching Soulection episodes #${START_EPISODE}+ from ${BASE_URL}...`);

  const encodedInput = encodeURIComponent(JSON.stringify({ collective: "soulection" }));
  const episodesRes = await fetchJson(
    `${BASE_URL}/api/trpc/episodes.all?input=${encodedInput}`
  );
  const allEpisodes = episodesRes.result.data;

  const filtered = allEpisodes
    .map((ep) => ({ ...ep, showNumber: extractShowNumber(ep.name) }))
    .filter((ep) => ep.showNumber !== null && ep.showNumber >= START_EPISODE)
    .sort((a, b) => a.showNumber - b.showNumber);

  console.log(`Found ${filtered.length} episodes (#${START_EPISODE}+)\n`);

  const episodesWithTracks = [];
  for (const episode of filtered) {
    process.stdout.write(`  Show #${String(episode.showNumber).padEnd(4)} ${episode.name.slice(0, 50)}... `);
    try {
      const tracksInput = encodeURIComponent(JSON.stringify({ episodeId: episode.id }));
      const tracksRes = await fetchJson(
        `${BASE_URL}/api/trpc/episode.getTracks?input=${tracksInput}`
      );
      const tracks = tracksRes.result.data;
      process.stdout.write(`${tracks.length} tracks\n`);
      episodesWithTracks.push({ ...episode, tracks });
    } catch (err) {
      process.stdout.write(`ERROR: ${err.message}\n`);
      episodesWithTracks.push({ ...episode, tracks: [] });
    }
  }

  const withTracks = episodesWithTracks.filter((e) => e.tracks.length > 0);

  const output = {
    fetchedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    startEpisode: START_EPISODE,
    totalEpisodes: episodesWithTracks.length,
    episodesWithTracks: withTracks.length,
    episodes: episodesWithTracks,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  const outputPath = join(ROOT, "data", "soulection-episodes.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${episodesWithTracks.length} episodes → data/soulection-episodes.json`);
  console.log(`Episodes with existing tracks: ${withTracks.length}`);
  console.log(`Episodes pending track import: ${episodesWithTracks.length - withTracks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
