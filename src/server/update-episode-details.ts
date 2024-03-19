import { Db, WithId } from "mongodb";
import { z } from "zod";
import { DBEpisode, EpisodeTrack } from "./router";
import { asyncResult, result } from "@expo/results";
import { set } from "date-fns";

const TimeFormat = z.string().regex(/^\d{2}:\d{2}:\d{2}$/);

export const trackInputSchema = z.object({
  order: z.number(),
  name: z.string(),
  artist: z.string(),
  platforms: z.array(z.string()).optional(),
  timestamp: TimeFormat.optional(),
});

export const updateEpisodeDetailsValuesSchema = z.object({
  releaseDate: z.date().optional(),
  name: z.string().optional(),
  tracks: z.array(trackInputSchema).optional(),
});
type UpdateEpisodeDetailsValues = z.infer<
  typeof updateEpisodeDetailsValuesSchema
>;

export async function updateEpisodeDetailsBySoundcloudUrl(
  db: Db,
  epSoundCloudUrl: string,
  input: UpdateEpisodeDetailsValues
) {
  const collection = db.collection<DBEpisode>("tracksOld");
  const episode = await collection.findOne({
    url: epSoundCloudUrl,
  });

  if (!episode) {
    return result(
      new Error(
        `Couldn't find episode by soundcloud url with url ${epSoundCloudUrl}`
      )
    );
  }

  return await asyncResult(updateEpisodeDetails(db, episode, input));
}

export async function updateEpisodeDetails(
  db: Db,
  episode: WithId<DBEpisode>,
  values: UpdateEpisodeDetailsValues
) {
  let releaseDate = episode.release_date;
  if (values.releaseDate) {
    releaseDate = set(values.releaseDate, { hours: 12 });
  }

  const episodeTracks = values.tracks
    ? values.tracks.map((t) => {
        return {
          artist: t.artist,
          episode_id: episode._id,
          links: t.platforms ?? [],
          name: t.name,
          order: t.order,
          timestamp: t.timestamp
            ? parseDurationToSeconds(t.timestamp)
            : undefined,
        } satisfies EpisodeTrack;
      })
    : episode.tracks;

  const updatedEpisode = {
    ...episode,
    name: values.name ?? episode.name,
    release_date: releaseDate,
    tracks: episodeTracks,
  } satisfies DBEpisode;

  const episodesCollection = db.collection<DBEpisode>("tracksOld");
  const updated = await episodesCollection.updateOne(
    { _id: episode._id },
    {
      $set: updatedEpisode,
    }
  );

  if (updated.modifiedCount < 1) {
    console.log("no updates happened. Sad");
  }

  console.log("updated result", updated);
}

function parseDurationToSeconds(durationString: string): number {
  // Split the duration string into hours, minutes, and seconds
  const [hours, minutes, seconds] = durationString.split(":").map(Number);
  // Calculate the total duration in seconds
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return totalSeconds;
}
