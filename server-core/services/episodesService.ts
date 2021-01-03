import { Db } from "mongodb";
import { SoundCloudApiClient } from "../crosscutting/soundCloudApiClient";
import { createNewEpisode, IEpisode } from "../domain/Episode";
import { EpisodesRepo } from "../repositories/episodesRepository";

interface DBTrack {
  _id: string;
  source: string;
  created_time: string;
  name: string;
  url: string;
  picture_large: string;
  duration: number;
}

export class EpisodesService {
  private scClient: SoundCloudApiClient;

  constructor(private episodesRepo: EpisodesRepo, private db: Db) {
    this.scClient = new SoundCloudApiClient();
  }

  async getAllEpisodes() {
    return this.episodesRepo.getAllEpisodes();
  }

  async getLatestEpisode() {
    return this.episodesRepo.getLatestEpisode();
  }

  async migrateTracksToEpisodes() {
    const tracksCollection = this.db.collection<DBTrack>("tracks");
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

    return this.episodesRepo.insertMany(migratedEpisodes);
  }

  async syncSoulectionFromSoundcloud() {
    const soulectionRadioSessionsPlaylistId = "8025093";

    // get latest episode
    const latestEpisode = await this.episodesRepo.getLatestEpisode();

    // get soulection episodes from soundcloud
    const scTrackDtos = await this.scClient
      .getPlaylistInfo(soulectionRadioSessionsPlaylistId)
      .then((res) => res.tracks);

    let newEpisodes: IEpisode[] = [];
    if (latestEpisode) {
      const sortedDtos = scTrackDtos.sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
      );

      const existingIndex = sortedDtos.findIndex(
        (dto) => dto.permalink_url === latestEpisode.sourceUrl
      );

      if (existingIndex > 0) {
        newEpisodes = sortedDtos.slice(0, existingIndex).map((dto) =>
          createNewEpisode({
            name: dto.title,
            artworkUrl: dto.artwork_url,
            duration: dto.duration,
            releaseDate: new Date(dto.created_at),
            source: "SOUNDCLOUD",
            sourceUrl: dto.permalink_url,
          })
        );

        console.log(`INFO: Found ${newEpisodes.length} episodes for sync`);
      } else {
        console.log("INFO: No new episodes synched");
      }
    } else {
      newEpisodes = scTrackDtos.map((dto) =>
        createNewEpisode({
          name: dto.title,
          artworkUrl: dto.artwork_url,
          duration: dto.duration,
          releaseDate: new Date(dto.created_at),
          source: "SOUNDCLOUD",
          sourceUrl: dto.permalink_url,
        })
      );
    }

    // Save the new episodes
    if (newEpisodes.length > 0) {
      await this.episodesRepo.insertMany(newEpisodes);
    }

    return newEpisodes;
  }
}

export function createEpisodesService(episodeRepo: EpisodesRepo, db: Db) {
  return new EpisodesService(episodeRepo, db);
}
