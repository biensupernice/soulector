import { Db } from "mongodb";
import { unauthorizedInvariant } from "../crosscutting/errorTypes";
import { SoundCloudApiClient } from "../crosscutting/soundCloudApiClient";
import { createNewEpisode, IEpisode } from "../domain/Episode";
import { EpisodesRepo } from "../repositories/episodesRepository";

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
    type DBTrack = {
      _id: string;
      source: string;
      created_time: string;
      name: string;
      url: string;
      picture_large: string;
      duration: number;
    };

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

    // get soulection episodes from soundcloud
    const scTrackDtos = await this.scClient
      .getPlaylistInfo(soulectionRadioSessionsPlaylistId)
      .then((res) => res.tracks);

    const existsRes = await this.episodesRepo.existManyByUrl(
      scTrackDtos.map((dto) => dto.permalink_url)
    );

    const missingEpUsrls = existsRes
      .filter((res) => !res.exists)
      .map((r) => r.url);

    const missingDtos = scTrackDtos.filter((dto) =>
      missingEpUsrls.includes(dto.permalink_url)
    );

    const eps = missingDtos.map((dto) =>
      createNewEpisode({
        name: dto.title,
        artworkUrl: dto.artwork_url,
        duration: dto.duration,
        releaseDate: new Date(dto.created_at),
        source: "SOUNDCLOUD",
        sourceUrl: dto.permalink_url,
      })
    );

    if (eps.length > 0) {
      return await this.episodesRepo.insertMany(eps);
    }

    return [];
  }
}

export function createEpisodesService(episodeRepo: EpisodesRepo, db: Db) {
  return new EpisodesService(episodeRepo, db);
}
