import { createDbConnection } from "./db";
import { createEpisodesRepo } from "./repositories/episodesRepository";
import {
  createEpisodesService,
  EpisodesService,
} from "./services/episodesService";

interface ISoulectorApp {
  episodesService: EpisodesService;
}

export async function createApp(): Promise<ISoulectorApp> {
  const db = await createDbConnection();
  const episodesRepo = createEpisodesRepo(db);
  const episodesService = createEpisodesService(episodesRepo, db);
  return { episodesService };
}

let app: ISoulectorApp;

export async function getApp() {
  if (app) {
    return app;
  }

  return await createApp();
}
