import { v4 } from "uuid";
import { z } from "zod";

const sourcesEnum = z.enum(["MIXCLOUD", "SOUNDCLOUD"]);

const episodeSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  sourceUrl: z.string(),
  artworkUrl: z.string(),
  duration: z.number(),
  releaseDate: z.date(),
  source: sourcesEnum,
});
export type Episode = z.infer<typeof episodeSchema>;

const episodeOptions = z.object({
  name: z.string(),
  sourceUrl: z.string(),
  artworkUrl: z.string(),
  duration: z.number(),
  releaseDate: z.date(),
  source: sourcesEnum,
});
type EpisodeOptions = z.infer<typeof episodeOptions>;

export function createNewEpisode(opts: EpisodeOptions): Episode {
  const options = episodeOptions.parse(opts);

  return episodeSchema.parse({
    id: v4(),
    updatedAt: new Date(),
    createdAt: new Date(),
    ...options,
  });
}
