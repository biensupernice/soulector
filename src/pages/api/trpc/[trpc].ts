import { Context, createContext } from "@/server/context";
import { createSoundCloudApiClient } from "@/server/crosscutting/soundCloudApiClient";
import * as trpc from "@trpc/server";
import * as trpcNext from "@trpc/server/adapters/next";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSoundCloudTracks } from "../internal/sync-episodes";
import path from "path";
import axios from "axios";
import fs from "fs";
import { asyncResult } from "@expo/results";
import Vibrant from "node-vibrant";

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
  })
  .query("episode.getAccentColor", {
    input: z.object({
      episodeId: z.string().optional(),
    }),
    async resolve({ input, ctx }) {
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
