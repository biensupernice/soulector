import { asyncResult } from "@expo/results";
import { createLambda, match } from "@yotie/micron";
import { getApp } from "../../../server-core/application";
import { mapErrorToResponse } from "../../../server-core/crosscutting/responseHelpers";
import { adminAuth } from "../../../server-core/middleware/adminAuthMiddleware";

export default createLambda(
  match({
    post: async (micronParams) => {
      const app = await getApp();
      const sycnedEpisodesRes = await asyncResult(
        app.episodesService.syncSoulectionFromSoundcloud()
      );

      if (!sycnedEpisodesRes.ok) {
        return mapErrorToResponse(sycnedEpisodesRes.reason, micronParams);
      }

      return micronParams.res.status(201).send(null);
    },
  }),
  { middlewares: [adminAuth] }
);
