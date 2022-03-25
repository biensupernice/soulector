import { Context, createContext } from "@/server/context";
import * as trpc from "@trpc/server";
import * as trpcNext from "@trpc/server/adapters/next";
import { z } from "zod";

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
  .query("hello", {
    input: z
      .object({
        text: z.string().nullish(),
      })
      .nullish(),
    resolve({ input }) {
      return {
        greeting: `hello ${input?.text ?? "world"}`,
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
  });

export type AppRouter = typeof appRouter;

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext,
});
