import { Context } from "@/server/context";
import {
  GetStreamUrlsDTO,
  createSoundCloudApiClient,
} from "@/server/crosscutting/soundCloudApiClient";
import { ObjectId, WithId } from "mongodb";
import { string, z } from "zod";
import path from "path";
import axios from "axios";
import fs from "fs";
import { asyncResult } from "@expo/results";
import Vibrant from "node-vibrant";
import { initTRPC } from "@trpc/server";
import { syncAllCollectives } from "@/pages/api/internal/sync-episodes";

const ENABLE_LOCAL_SOURCE = process.env.ENABLE_LOCAL_SOURCE
  ? process.env.ENABLE_LOCAL_SOURCE.toLowerCase() === "true"
  : false;

export type EpisodeTrack = {
  order: number;
  episode_id: ObjectId;
  name: string;
  artist: string;
  timestamp?: number;
  links: string[];
};

export type EpisodeTrackProjection = ReturnType<typeof episodeTrackProjection>;
export function episodeTrackProjection(t: EpisodeTrack) {
  return {
    order: t.order,
    name: t.name,
    artist: t.artist,
    ...(t.timestamp ? { timestamp: t.timestamp } : null),
  } as const;
}

export type DBEpisode = {
  source: "SOUNDCLOUD" | "MIXCLOUD";
  duration: number;
  created_time: Date;
  release_date?: Date;
  key: number | string;
  name: string;
  url: string;
  picture_large: string;
  collective_slug:
    | "soulection"
    | "sasha-marie-radio"
    | "the-love-below-hour"
    | "local";
  tracks?: EpisodeTrack[];
};

export type EpisodeProjection = ReturnType<typeof episodeProjectionFromDb>;
export type EpisodeCollectiveSlugProjection = DBEpisode["collective_slug"];
export function episodeProjectionFromDb(e: WithId<DBEpisode>) {
  return {
    id: e._id.toString(),
    source: e.source,
    duration: e.duration,
    releasedAt: e.release_date
      ? e.release_date.toISOString()
      : e.created_time.toISOString(),
    createadAt: e.created_time.toISOString(),
    embedPlayerKey: e.key,
    name: e.name,
    permalinkUrl: e.url,
    collectiveSlug: e.collective_slug,
    artworkUrl: e.picture_large,
  } as const;
}

export function episodeProjectionFromFromObj(
  e: DBEpisode & { id: string },
): EpisodeProjection {
  return {
    id: e.id,
    source: e.source,
    duration: e.duration,
    releasedAt: e.release_date
      ? e.release_date.toISOString()
      : e.created_time.toISOString(),
    createadAt: e.created_time.toISOString(),
    embedPlayerKey: e.key,
    name: e.name,
    permalinkUrl: e.url,
    collectiveSlug: e.collective_slug,
    artworkUrl: e.picture_large,
  } as const;
}

const localEpisodesCollection = [
  {
    id: "jda-current-rotation-001",
    collective_slug: "local",
    created_time: new Date("Nov 7, 2024 5:14:10 PM EST"),
    release_date: new Date("Nov 7, 2024 5:14:10 PM EST"),
    duration: 7229,
    key: "jda-current-rotation-001",
    name: "JDA's Current Rotation | 001",
    picture_large:
      "https://clrdbin-assets.jalvarado.dev/current_rotation_001_art.png",
    source: "SOUNDCLOUD",
    url: "https://clrdbin-assets.jalvarado.dev/current_rotation_001.mp3",
  },
] satisfies Array<DBEpisode & { id: string }>;

async function downloadImageFromUrl(
  url: string,
  name: string,
  basePath = "/tmp/",
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
    const trackCollection = ctx.db.collection<DBEpisode>("tracksOld");

    trackCollection.updateMany(
      {},
      {
        $set: {
          collective_slug: "soulection",
        },
      },
    );
  }),
  "episodes.all": publicProcedure
    .input(
      z.optional(
        z.object({
          collective: z.enum([
            "all",
            "soulection",
            "sasha-marie-radio",
            "local",
          ]),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      const collective = input?.collective ?? "soulection";

      const isLocalEnabled = ENABLE_LOCAL_SOURCE;
      const localTracks = isLocalEnabled
        ? localEpisodesCollection.map(episodeProjectionFromFromObj)
        : [];

      let dbTracksFilter =
        collective === "all" || collective === "local"
          ? {}
          : { collective_slug: collective };

      const trackCollection = ctx.db.collection<DBEpisode>("tracksOld");
      let allDbTracks = await trackCollection
        .find(dbTracksFilter, {
          projection: {
            source: 1,
            duration: 1,
            created_time: 1,
            release_date: 1,
            key: 1,
            name: 1,
            url: 1,
            picture_large: 1,
            collective_slug: 1,
          },
        })
        .sort({
          created_time: -1,
        })
        .toArray();

      const dbTrackProjections = allDbTracks.map(episodeProjectionFromDb);

      const allTracks = [...localTracks, ...dbTrackProjections];
      return allTracks.sort(
        (a, b) =>
          new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime(),
      );
    }),
  "episode.getStreamUrl": publicProcedure
    .input(
      z.object({
        episodeId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { episodeId } = input;

      const isLocalEnabled = ENABLE_LOCAL_SOURCE;
      const localEpisode = isLocalEnabled
        ? localEpisodesCollection.find((e) => e.id === episodeId)
        : null;

      if (localEpisode) {
        return {
          http_mp3_128_url: localEpisode.url,
          hls_mp3_128_url: localEpisode.url,
          hls_opus_64_url: localEpisode.url,
          preview_mp3_128_url: localEpisode.url,
        } satisfies GetStreamUrlsDTO;
      }

      const trackCollection = ctx.db.collection<DBEpisode>("tracksOld");
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
      }),
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

      const localEpisode = localEpisodesCollection.find(
        (e) => e.id === episodeId,
      );

      const trackCollection = ctx.db.collection<DBEpisode>("tracksOld");
      const dbEpisode = !!localEpisode
        ? null
        : await trackCollection.findOne({
            _id: new ObjectId(episodeId),
          });

      const episode = !!localEpisode ? localEpisode : dbEpisode;
      if (!episode) {
        return defaultAccentColor;
      }

      const albumArtUrl = episode.picture_large;
      const downloadAlbumArtResult = await asyncResult(
        downloadImageFromUrl(albumArtUrl, episode.url, "/tmp"),
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
  "episode.getTracks": publicProcedure
    .input(
      z.object({
        episodeId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const trackCollection = ctx.db.collection<DBEpisode>("tracksOld");
      const episode = await trackCollection.findOne({
        _id: new ObjectId(input.episodeId),
      });

      const tracks = episode?.tracks ?? [];
      return tracks.map(episodeTrackProjection);
    }),
  "episode.getFakeStreamUrl": publicProcedure
    .input(
      z.object({
        episodeId: z.string(),
      }),
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
