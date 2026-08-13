import { NextApiRequest, NextApiResponse } from "next";
import { createDbConnection } from "@/server/db";
import { getSoundCloudTracks } from "@/server/sync-episodes";
import { recordSyncRun } from "@/server/sync-runs";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const db = await createDbConnection();

    // Recorded so the admin screen can show whatever schedule calls this
    // alongside the runs triggered by hand.
    const summary = await recordSyncRun(db, "episodes", "api", async () => {
      const insertedNames = await getSoundCloudTracks(db);
      return {
        kind: "episodes" as const,
        insertedCount: insertedNames.length,
        insertedNames,
        byCollective: [
          { collectiveSlug: "soulection", insertedCount: insertedNames.length },
        ],
      };
    });

    console.log("successfully retrieved tracks");
    res.status(200).json({
      msg: "Successfully Fetched New Tracks",
      retrievedTracks: summary.insertedNames,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};
