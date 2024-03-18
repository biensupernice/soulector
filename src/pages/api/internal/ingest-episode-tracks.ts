import { createDbConnection } from "@/server/db";
import {
  trackInputSchema,
  updateEpisodeDetailsBySoundcloudUrl,
} from "@/server/update-episode-details";
import { set } from "date-fns";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

const inputSchema = z.object({
  soundCloudUrl: z.string(),
  releaseDate: z.coerce
    .date()
    .transform((v) => set(v, { hours: 12 }))
    .optional(),
  tracks: z.array(trackInputSchema),
});

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const parsedInput = inputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      const { errors } = parsedInput.error;

      return res.status(400).json({
        error: { message: "Invalid request", errors },
      });
    }

    const db = await createDbConnection();
    const updateRes = await updateEpisodeDetailsBySoundcloudUrl(
      db,
      parsedInput.data.soundCloudUrl,
      {
        releaseDate: parsedInput.data.releaseDate,
        tracks: parsedInput.data.tracks,
      }
    );

    if (!updateRes.ok) {
      return res.status(400).json({
        error: {
          message: "Something went wrong ingesting episode tracks",
          errors: updateRes.reason,
        },
      });
    }

    res.status(200).json({
      message: "Data processed successfully",
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};
