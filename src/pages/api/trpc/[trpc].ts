import { Context, createContext } from "@/server/context";
import { createSoundCloudApiClient } from "@/server/crosscutting/soundCloudApiClient";
import * as trpc from "@trpc/server";
import * as trpcNext from "@trpc/server/adapters/next";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSoundCloudTracks } from "../internal/sync-episodes";

export type ITrack = {
  _id: string;
  source: "SOUNDCLOUD" | "MIXCLOUD";
  duration: number;
  created_time: string;
  key: number;
  name: string;
  url: string;
  picture_large: string;
};

const appRouter = trpc
  .router<Context>()
  .query("internal.episodesSync", {
    async resolve({ ctx }) {
      let retrieved = await getSoundCloudTracks(ctx.db);

      return {
        msg: "Successfully Fetched New Tracks",
        retrievedTracks: retrieved,
      };
    },
  })
  .query("episodes.all", {
    async resolve({ ctx }) {
      const trackCollection = ctx.db.collection<ITrack>("tracksOld");
      let allTracks = await trackCollection
        .find({})
        .sort({
          created_time: -1,
        })
        .toArray();

      return allTracks;
    },
  })
  .query("episode.getStreamUrl", {
    input: z.object({
      episodeId: z.string(),
    }),
    async resolve({ input, ctx }) {
      const { episodeId } = input;

      const trackCollection = ctx.db.collection<ITrack>("tracksOld");
      const episode = await trackCollection.findOne({
        _id: new ObjectId(episodeId),
      });

      if (!episode) {
        return null;
      }

      const scTrackId = `${episode.key}`;
      const scClient = await createSoundCloudApiClient();
      const streamUrls = await scClient.getStreamUrls(scTrackId);

      return streamUrls;
    },
  });

export type AppRouter = typeof appRouter;

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext,
});
