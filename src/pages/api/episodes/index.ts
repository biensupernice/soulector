import { asyncResult } from "@expo/results";
import { createLambda, match } from "@yotie/micron";
import { createApp } from "@/server/application";
import { responseFromResult } from "@/server/crosscutting/responseHelpers";
import type { NextApiRequest, NextApiResponse } from "next";
import { createDbConnection } from "@/server/db";

// export default createLambda(
//   match({
//     get: async (micronParams) => {
//       const app = await createApp();
//       const epsRes = await asyncResult(app.episodesService.getAllEpisodes());
//       return responseFromResult(epsRes, micronParams);
//     },
//   })
// );

async function getAllTracks() {
  const db = await createDbConnection();

  const trackCollection = db.collection("tracksOld");
  let allTracks = await trackCollection
    .find({})
    .sort({
      created_time: -1,
    })
    .toArray();

  return allTracks;
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    let tracks = await getAllTracks();

    console.log("successfully retrieved tracks");
    res.status(200).json({ tracks });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};
