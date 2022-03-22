import { asyncResult } from "@expo/results";
import { createLambda, match } from "@yotie/micron";
import { NextApiRequest, NextApiResponse } from "next";

import _ from "lodash";
import { SoundCloudApiClient } from "@/server/crosscutting/soundCloudApiClient";
import { createDbConnection } from "@/server/db";

let SOUNDCLOUD_URL = process.env.SOUNDCLOUD_URL || "no_sooundcloud_url";
let MONGO_CONNECTION_STRING =
  process.env.MONGO_CONNECTION_STRING || "noconnectionstringpassed";

function createLargeSoundtrackThumbUrl(url: string) {
  const newUrl = url.replace("-large", "-t500x500");
  return newUrl;
}

async function getSoundCloudTracks() {
  const soundCloudClient = new SoundCloudApiClient();
  await soundCloudClient.getToken();

  const trackDtos = await soundCloudClient
    .getPlaylistInfo("8025093")
    .then((res) => res.tracks);

  let mapped = trackDtos.map((track) => ({
    source: "SOUNDCLOUD",
    duration: parseInt(`${track.duration / 1000}`, 10),
    created_time: new Date(track.created_at),
    key: track.id,
    name: track.title,
    url: track.permalink_url,
    picture_large: createLargeSoundtrackThumbUrl(track.artwork_url),
  }));

  type TrackType = typeof mapped[0];

  const db = await createDbConnection();
  let incomingIds = mapped.map((it) => it.key);

  const trackCollection = db.collection<TrackType>("tracksOld");

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
    let retrieved = await getSoundCloudTracks();

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

// export default createLambda(
//   match({
//     post: async (micronParams) => {
//       const app = await getApp();
//       const sycnedEpisodesRes = await asyncResult(
//         app.episodesService.syncSoulectionFromSoundcloud()
//       );

//       if (!sycnedEpisodesRes.ok) {
//         return mapErrorToResponse(sycnedEpisodesRes.reason, micronParams);
//       }

//       return micronParams.res.status(201).send(null);
//     },
//   }),
//   { middlewares: [adminAuth] }
// );
