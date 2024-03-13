import { Context } from "@/server/context";
import { createSoundCloudApiClient } from "@/server/crosscutting/soundCloudApiClient";
import { ObjectId } from "mongodb";
import { z } from "zod";
import path from "path";
import axios from "axios";
import fs from "fs";
import { asyncResult } from "@expo/results";
import Vibrant from "node-vibrant";
import { initTRPC } from "@trpc/server";
import { syncAllCollectives } from "@/pages/api/internal/sync-episodes";

export type ITrack = {
  _id: string;
  source: "SOUNDCLOUD" | "MIXCLOUD";
  duration: number;
  created_time: string;
  key: number;
  name: string;
  url: string;
  picture_large: string;
  collective_slug: "soulection" | "sasha-marie-radio";
};

async function downloadImageFromUrl(
  url: string,
  name: string,
  basePath = "/tmp/"
) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });
    const fileName = path.basename(name);
    const filePath = path.join(basePath, fileName);

    fs.writeFileSync(filePath, response.data);

    return { fileName, filePath };
  } catch (error) {
    throw new Error(`Failed to download image from URL: ${name}`);
  }
}

const t = initTRPC.context<Context>().create();

// Base router and procedure helpers
const router = t.router;
const publicProcedure = t.procedure;

export const episodeRouter = router({
  "internal.episodesSync": publicProcedure.query(async ({ ctx }) => {
    let retrieved = await syncAllCollectives(ctx.db);

    return {
      msg: "Successfully Fetched New Tracks",
      retrievedTracks: retrieved,
    };
  }),
  "internal.backfillCollectives": publicProcedure.query(({ ctx }) => {
    const trackCollection = ctx.db.collection<ITrack>("tracksOld");

    trackCollection.updateMany(
      {},
      {
        $set: {
          collective_slug: "soulection",
        },
      }
    );
  }),
  "episodes.all": publicProcedure
    .input(
      z.optional(
        z.object({
          collective: z.enum(["all", "soulection", "sasha-marie-radio"]),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      const collective = input?.collective ?? "soulection";

      let filter = collective === "all" ? {} : { collective_slug: collective };

      const trackCollection = ctx.db.collection<ITrack>("tracksOld");
      let allTracks = await trackCollection
        .find(filter)
        .sort({
          created_time: -1,
        })
        .toArray();

      return allTracks;
    }),
  "episode.getStreamUrl": publicProcedure
    .input(
      z.object({
        episodeId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
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
    }),
  "episode.getAccentColor": publicProcedure
    .input(
      z.object({
        episodeId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { episodeId } = input;

      const defaultAccentColor = {
        rgb: [0, 0, 0],
        hsl: [0, 0, 0], // TODO Fix default from rgb 24 24 27
        bodyTexColor: "black",
        titleTextColor: "black",
      };

      if (!episodeId) {
        return defaultAccentColor;
      }

      const trackCollection = ctx.db.collection<ITrack>("tracksOld");
      const episode = await trackCollection.findOne({
        _id: new ObjectId(episodeId),
      });

      if (!episode) {
        return defaultAccentColor;
      }

      const albumArtUrl = episode.picture_large;
      const downloadAlbumArtResult = await asyncResult(
        downloadImageFromUrl(albumArtUrl, episode.url, "/tmp")
      );

      if (!downloadAlbumArtResult.ok) {
        console.error(downloadAlbumArtResult.reason);
        throw downloadAlbumArtResult.reason;
      }

      const { filePath } = downloadAlbumArtResult.value;
      const palette = await Vibrant.from(filePath).getPalette();

      const swatch =
        palette.DarkVibrant || palette.Vibrant || palette.DarkMuted;

      if (!swatch) {
        return defaultAccentColor;
      }

      const darkVibrantResult = {
        rgb: swatch.rgb,
        hsl: [swatch.hsl[0], swatch.hsl[1], swatch.hsl[2]],
        bodyTexColor: swatch.getBodyTextColor(),
        titleTextColor: swatch.getTitleTextColor(),
      };

      return darkVibrantResult;
    }),
  "episode.getFakeStreamUrl": publicProcedure
    .input(
      z.object({
        episodeId: z.string(),
      })
    )
    .query(async ({ input }) => {
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
    }),
});

export type EpisodeRouter = typeof episodeRouter;
