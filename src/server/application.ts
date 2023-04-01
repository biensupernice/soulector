import { inferAsyncReturnType } from "@trpc/server";
import { createDbConnection } from "./db";
import { createEpisodesRepo } from "./episodes/episodesRepository";

type ISoulectorApp = inferAsyncReturnType<typeof createApp>;

export async function createApp() {
  const db = await createDbConnection();
  const episodesRepo = createEpisodesRepo(db);
  return { db, episodesRepo };
}

let app: ISoulectorApp;

export async function getApp() {
  if (app) {
    return app;
  }

  return await createApp();
}
