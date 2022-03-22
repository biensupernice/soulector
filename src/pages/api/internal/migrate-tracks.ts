import { asyncResult } from "@expo/results";
import { createLambda, match } from "@yotie/micron";
import { getApp } from "@/server/application";
import { responseFromResult } from "@/server/crosscutting/responseHelpers";
import { adminAuth } from "@/server/middleware/adminAuthMiddleware";

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
