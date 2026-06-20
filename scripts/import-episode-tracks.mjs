#!/usr/bin/env node
/**
 * Imports episode track data into the soulector database.
 *
 * Reads data/soulection-episode-tracks.json (or a supplied path) and for
 * every episode calls the authenticated internal.importEpisodeTrackInfo
 * tRPC endpoint on soulector.app.
 *
 * Usage:
 *   node scripts/import-episode-tracks.mjs [json-file-path]
 *
 * Environment:
 *   SOULECTOR_BASE_URL        defaults to https://soulector.app
 *   INTERNAL_AUTH_USERNAME    required (unless DRY_RUN=true)
 *   INTERNAL_AUTH_PASSWORD    required (unless DRY_RUN=true)
 *   DRY_RUN                   set to "true" to preview without making changes
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BASE_URL = process.env.SOULECTOR_BASE_URL ?? "https://soulector.app";
const USERNAME = process.env.INTERNAL_AUTH_USERNAME;
const PASSWORD = process.env.INTERNAL_AUTH_PASSWORD;
const DRY_RUN = process.env.DRY_RUN === "true";

const filePath =
  process.argv[2] ?? join(ROOT, "data", "soulection-episode-tracks.json");

async function importEpisodeTracks(episode) {
  const body = {
    json: {
      streaming_urls: { soundcloud_url: episode.soulectorPermalinkUrl },
      tracks: episode.tracks.map((t) => ({
        track_number: t.order,
        song: t.name,
        artist: t.artist,
        ...(t.timestamp ? { timestamp: t.timestamp } : {}),
      })),
    },
  };

  if (DRY_RUN) {
    console.log(
      `  [DRY RUN] Would import ${episode.tracks.length} tracks for Show #${episode.showNumber}`
    );
    return;
  }

  const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
  const res = await fetch(`${BASE_URL}/api/trpc/internal.importEpisodeTrackInfo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const msg =
      data.error?.json?.message ??
      data.error?.message ??
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data.result?.data;
}

async function main() {
  if (!DRY_RUN && (!USERNAME || !PASSWORD)) {
    console.error(
      "Error: INTERNAL_AUTH_USERNAME and INTERNAL_AUTH_PASSWORD must be set (or use DRY_RUN=true)"
    );
    process.exit(1);
  }

  console.log(`Reading from ${filePath} ...`);
  const raw = readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);

  const episodes = data.episodes ?? [];
  console.log(`Found ${episodes.length} episodes to import\n`);

  if (episodes.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  if (DRY_RUN) console.log("[DRY RUN — no changes will be made]\n");

  let imported = 0;
  let failed = 0;

  for (const episode of episodes) {
    process.stdout.write(
      `Importing Show #${episode.showNumber} (${episode.tracks.length} tracks)... `
    );
    try {
      await importEpisodeTracks(episode);
      process.stdout.write("OK\n");
      imported++;
    } catch (err) {
      process.stdout.write(`FAILED: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\nDone. Imported: ${imported} | Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
