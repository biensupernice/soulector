import { micron, MicronParams } from "@yotie/micron";
import { createApp } from "../../../server-core/application";

export default micron(async ({ ok }: MicronParams) => {
  const app = await createApp();
  const eps = await app.episodesService.getAllEpisodes();

  return ok({ episodes: eps });
});
