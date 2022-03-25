import { inferAsyncReturnType } from "@trpc/server";
import { createDbConnection } from "./db";
import { createEpisodesRepo } from "./repositories/episodesRepository";
import { createEpisodesService } from "./services/episodesService";

type ISoulectorApp = inferAsyncReturnType<typeof createApp>;

export async function createApp() {
  const db = await createDbConnection();
  const episodesRepo = createEpisodesRepo(db);
  const episodesService = createEpisodesService(episodesRepo, db);
  return { db, episodesService };
}

let app: ISoulectorApp;

export async function getApp() {
  if (app) {
    return app;
  }

  return await createApp();
}
