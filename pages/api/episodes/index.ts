import { asyncResult } from "@expo/results";
import { createLambda, match } from "@yotie/micron";
import { createApp } from "../../../server-core/application";
import { responseFromResult } from "../../../server-core/crosscutting/responseHelpers";

export default createLambda(
  match({
    get: async (micronParams) => {
      const app = await createApp();
      const epsRes = await asyncResult(app.episodesService.getAllEpisodes());
      return responseFromResult(epsRes, micronParams);
    },
  })
);
