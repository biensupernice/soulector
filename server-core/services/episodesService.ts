import { EpisodesRepo } from "../repositories/episodesRepository";

export class EpisodesService {
  constructor(private episodesRepo: EpisodesRepo) {}

  async getAllEpisodes() {
    return this.episodesRepo.getAllEpisodes();
  }

  async syncSoulectionFromSoundcloud() {
    const currentEps = await this.episodesRepo.getAllEpisodes();

    const newEps = [];
  }
}

export function createEpisodesService(episodeRepo: EpisodesRepo) {
  return new EpisodesService(episodeRepo);
}
