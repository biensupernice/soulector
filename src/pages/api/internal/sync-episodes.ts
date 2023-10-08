import { NextApiRequest, NextApiResponse } from "next";

import _ from "lodash";
import { SoundCloudApiClient } from "@/server/crosscutting/soundCloudApiClient";
import { createDbConnection } from "@/server/db";
import { Db } from "mongodb";
import { ITrack } from "../trpc/[trpc]";

function createLargeSoundtrackThumbUrl(url: string) {
  const newUrl = url.replace("-large", "-t500x500");
  return newUrl;
}

const playlists = {
  soulection: "8025093",
  "sasha-marie-radio": "944232886",
} as const;
type PlaylistSlugs = keyof typeof playlists;

export async function syncAllCollectives(db: Db) {
  const slugs: PlaylistSlugs[] = ["soulection", "sasha-marie-radio"];
  for (const s of slugs) {
    await getSoundCloudTracks(db, s);
  }
}

export async function getSoundCloudTracks(
  db: Db,
  collectiveSlug: "soulection" | "sasha-marie-radio" = "soulection"
) {
  const soundCloudClient = new SoundCloudApiClient();
  await soundCloudClient.getToken();

  const trackDtos = await soundCloudClient
    .getPlaylistInfo(playlists[collectiveSlug])
    .then((res) => res.tracks);

  let mapped: Omit<ITrack, "_id">[] = trackDtos.map((track) => ({
    source: "SOUNDCLOUD",
    duration: parseInt(`${track.duration / 1000}`, 10),
    created_time: new Date(track.created_at),
    key: track.id,
    name: track.title,
    url: track.permalink_url,
    collective_slug: collectiveSlug,
    picture_large: createLargeSoundtrackThumbUrl(track.artwork_url),
  }));

  let incomingIds = mapped.map((it) => it.key);

  const trackCollection = db.collection<Omit<ITrack, "_id">>("tracksOld");

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

  let insertRes = await trackCollection.insertMany(missingTracks);
  if (insertRes.insertedCount !== missingTracks.length) {
    console.log("inserted count didn't match data count");
  }
  console.log(
    "inserted soulection count",
    insertRes.insertedCount,
    insertRes.insertedIds
  );

  return missingTracks.map((track) => track && track.name);
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const db = await createDbConnection();
    let retrieved = await getSoundCloudTracks(db);

    console.log("successfully retrieved tracks");
    res.status(200).json({
      msg: "Successfully Fetched New Tracks",
      retrievedTracks: retrieved,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};
