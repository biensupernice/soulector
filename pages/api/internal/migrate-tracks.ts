import { asyncResult } from "@expo/results";
import { post } from "@yotie/micron";
import { getApp } from "../../../server-core/application";
import { responseFromResult } from "../../../server-core/crosscutting/responseHelpers";

export default post(async (micronParams) => {
  const app = await getApp();
  const migratedEpisodesRes = await asyncResult(
    app.episodesService.migrateTracksToEpisodes()
  );

  return responseFromResult(migratedEpisodesRes, micronParams);
});
