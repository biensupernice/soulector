import { Db } from "mongodb";
import { createNewEpisode } from "./Episode";
import { EpisodesRepo } from "./episodesRepository";

export async function migrateTracksToEpisodes(
  episodesRepo: EpisodesRepo,
  db: Db
) {
  type DBTrack = {
    _id: string;
    source: string;
    created_time: string;
    name: string;
    url: string;
    picture_large: string;
    duration: number;
  };

  const tracksCollection = db.collection<DBTrack>("tracks");
  const oldTracks = await tracksCollection.find({}).toArray();

  const migratedEpisodes = oldTracks.map((ot) =>
    createNewEpisode({
      name: ot.name,
      duration: ot.duration,
      artworkUrl: ot.picture_large,
      source: ot.source === "SOUNDCLOUD" ? "SOUNDCLOUD" : "MIXCLOUD",
      releaseDate: new Date(ot.created_time),
      sourceUrl: ot.url,
    })
  );

  return episodesRepo.insertMany(migratedEpisodes);
}
