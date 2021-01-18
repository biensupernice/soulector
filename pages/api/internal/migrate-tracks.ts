import { asyncResult } from "@expo/results";
import { createLambda, match } from "@yotie/micron";
import { getApp } from "../../../server-core/application";
import { responseFromResult } from "../../../server-core/crosscutting/responseHelpers";
import { adminAuth } from "../../../server-core/middleware/adminAuthMiddleware";

export default createLambda(
  match({
    post: async (micronParams) => {
      const app = await getApp();
      const migratedEpisodesRes = await asyncResult(
        app.episodesService.migrateTracksToEpisodes()
      );

      return responseFromResult(migratedEpisodesRes, micronParams);
    },
  }),
  { middlewares: [adminAuth] }
);
