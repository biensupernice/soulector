import { createDbConnection } from "./db";
import { createEpisodesRepo } from "./repositories/episodesRepository";
import { createEpisodesService } from "./services/episodesService";

export async function createApp() {
  const db = await createDbConnection();
  const episodesRepo = createEpisodesRepo(db);
  const episodesService = createEpisodesService(episodesRepo, db);

  return { episodesService };
}
