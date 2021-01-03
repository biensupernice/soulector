import { MicronParams, post } from "@yotie/micron";
import { createApp } from "../../../server-core/application";

export default post(async ({ ok }: MicronParams) => {
  const app = await createApp();
  const migratedEpisodes = await app.episodesService.migrateTracksToEpisodes();

  return ok({ migratedEpisodes });
});
