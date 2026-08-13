import _ from "lodash";
import { Db } from "mongodb";
import { SoundCloudApiClient } from "@/server/crosscutting/soundCloudApiClient";
import { DBEpisode } from "@/server/router";
import { recordSyncRun, SyncRunTrigger } from "@/server/sync-runs";

function createLargeSoundCloudThumbUrl(url: string) {
  const newUrl = url.replace("-large", "-t500x500");
  return newUrl;
}

const playlists = {
  soulection: "8025093",
  "sasha-marie-radio": "944232886",
  "the-love-below-hour": "269025488",
} as const;
export type PlaylistSlugs = keyof typeof playlists;

export const collectiveSlugs = Object.keys(playlists) as PlaylistSlugs[];

export type EpisodesSyncResult = {
  insertedCount: number;
  insertedNames: string[];
  byCollective: { collectiveSlug: PlaylistSlugs; insertedNames: string[] }[];
};

export async function syncAllCollectives(db: Db): Promise<EpisodesSyncResult> {
  const byCollective: EpisodesSyncResult["byCollective"] = [];

  for (const collectiveSlug of collectiveSlugs) {
    const insertedNames = await getSoundCloudTracks(db, collectiveSlug);
    byCollective.push({ collectiveSlug, insertedNames });
  }

  const insertedNames = byCollective.flatMap((c) => c.insertedNames);

  return {
    insertedCount: insertedNames.length,
    insertedNames,
    byCollective,
  };
}

/** Every collective, with the run written to the history the admin screen reads. */
export async function runEpisodesSync(db: Db, trigger: SyncRunTrigger) {
  return recordSyncRun(db, "episodes", trigger, async () => {
    const result = await syncAllCollectives(db);
    return {
      kind: "episodes" as const,
      insertedCount: result.insertedCount,
      insertedNames: result.insertedNames,
      byCollective: result.byCollective.map((c) => ({
        collectiveSlug: c.collectiveSlug,
        insertedCount: c.insertedNames.length,
      })),
    };
  });
}

export async function getSoundCloudTracks(
  db: Db,
  collectiveSlug: PlaylistSlugs = "soulection",
) {
  const soundCloudClient = new SoundCloudApiClient();
  await soundCloudClient.getToken();

  const trackDtos = await soundCloudClient
    .getPlaylistInfo(playlists[collectiveSlug])
    .then((res) => res.tracks);

  let mapped = trackDtos.map((track) => ({
    source: "SOUNDCLOUD",
    duration: parseInt(`${track.duration / 1000}`, 10),
    created_time: new Date(track.created_at),
    key: track.id,
    name: track.title,
    url: track.permalink_url,
    collective_slug: collectiveSlug,
    picture_large: createLargeSoundCloudThumbUrl(track.artwork_url),
  })) satisfies DBEpisode[];

  let incomingIds = mapped.map((it) => it.key);

  const trackCollection = db.collection<DBEpisode>("tracksOld");

  let existing = await trackCollection
    .find({
      key: {
        $in: incomingIds,
      },
    })
    .toArray();

  let existingIds = existing.map((doc) => doc.key);
  let missingKeys = _.difference(incomingIds, existingIds);
  let missingTracks = mapped.filter((it) => missingKeys.includes(it.key));

  console.log("missingTracks", missingTracks);

  if (missingTracks.length === 0) {
    return [];
  }

  let insertRes = await trackCollection.insertMany(missingTracks);
  if (insertRes.insertedCount !== missingTracks.length) {
    console.log("inserted count didn't match data count");
  }
  console.log(
    "inserted soulection count",
    insertRes.insertedCount,
    insertRes.insertedIds,
  );

  return missingTracks.map((track) => track && track.name);
}
