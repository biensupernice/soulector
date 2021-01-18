import { asyncResult } from "@expo/results";
import { post } from "@yotie/micron";
import { getApp } from "../../../server-core/application";
import { mapErrorToResponse } from "../../../server-core/crosscutting/responseHelpers";

export default post(async (micronPrams) => {
  const app = await getApp();
  const sycnedEpisodesRes = await asyncResult(
    app.episodesService.syncSoulectionFromSoundcloud()
  );

  if (!sycnedEpisodesRes.ok) {
    return mapErrorToResponse(sycnedEpisodesRes.reason, micronPrams);
  }

  return micronPrams.res.status(201).send(null);
});
