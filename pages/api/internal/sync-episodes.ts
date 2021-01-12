import { asyncResult } from "@expo/results";
import { post } from "@yotie/micron";
import { createApp, getApp } from "../../../server-core/application";
import { responseFromResult } from "../../../server-core/crosscutting/responseHelpers";

export default post(async (micronPrams) => {
  const app = await getApp();
  const sycnedEpisodesRes = await asyncResult(
    app.episodesService.syncSoulectionFromSoundcloud()
  );

  return responseFromResult(sycnedEpisodesRes, micronPrams);
});
