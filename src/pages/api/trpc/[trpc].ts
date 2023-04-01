import { Context, createContext } from "@/server/context";
import { createSoundCloudApiClient } from "@/server/crosscutting/soundCloudApiClient";
import { syncEpisodesFromSoundCloud } from "@/server/episodes/syncEpisodesFromSoundCloud";
import * as trpc from "@trpc/server";
import { TRPCError } from "@trpc/server";
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
  .query("internal.episodesSyncNew", {
    async resolve({ ctx }) {
      let syncRes = await syncEpisodesFromSoundCloud(ctx.episodesRepo);

      if (!syncRes.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: syncRes.reason.message,
          cause: syncRes.reason,
        });
      }

      return syncRes.value;
    },
  })
  .query("collectives.all", {
    async resolve({ ctx }) {
      return {
        collectives: [
          {
            id: "coll|soulection-radio",
            name: "Soulection Radio",
            handle: "soulection",
          },
          {
            id: "coll|sasha-marie-radio",
            name: "Sasha Marie Radio",
            handle: "sasha-marie",
          },
        ],
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
  .query("episodes.list", {
    input: z.optional(
      z.object({
        // TODO
        // page_token: z.optional(z.string()),
        filter: z.optional(
          z.object({
            collective: z.optional(z.enum(["soulection", "sasha-marie-radio"])),
          })
        ),
      })
    ),
    async resolve({ input, ctx }) {
      const collective = input?.filter?.collective ?? "soulection";

      return collective;
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
  })
  .query("episode.getFakeStreamUrl", {
    input: z.object({
      episodeId: z.string(),
    }),
    async resolve({ input }) {
      const { episodeId } = input;

      const timeStr = new Date().getTime();

      console.log({ episodeId });

      const fakeEpisodeUrls = {
        http_mp3_128_url: `/_test/iL2cZd7Gy8Ol.128.mp3?rand=${timeStr}`,
        hls_mp3_128_url: "/_test/iL2cZd7Gy8Ol.128.mp3",
        hls_opus_64_url: "/_test/iL2cZd7Gy8Ol.128.mp3",
        preview_mp3_128_url: "/_test/iL2cZd7Gy8Ol.128.mp3",
      };

      return fakeEpisodeUrls;
    },
  });

export type AppRouter = typeof appRouter;

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext,
});
