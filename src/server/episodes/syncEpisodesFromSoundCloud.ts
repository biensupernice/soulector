import { createSoundCloudApiClient } from "@/server/crosscutting/soundCloudApiClient";
import { createNewEpisode } from "./Episode";
import { EpisodesRepo } from "./episodesRepository";

export async function syncEpisodesFromSoundCloud(episodesRepo: EpisodesRepo) {
  const scClient = await createSoundCloudApiClient();

  const soulectionRadioSessionsPlaylistId = "8025093";

  // get soulection episodes from soundcloud
  const scTrackDtos = await scClient
    .getPlaylistInfo(soulectionRadioSessionsPlaylistId)
    .then((res) => res.tracks);

  const existsRes = await episodesRepo.existManyByUrl(
    scTrackDtos.map((dto) => dto.permalink_url)
  );

  const missingEpUsrls = existsRes
    .filter((res) => !res.exists)
    .map((r) => r.url);

  const missingDtos = scTrackDtos.filter((dto) =>
    missingEpUsrls.includes(dto.permalink_url)
  );

  const eps = missingDtos.map((dto) =>
    createNewEpisode({
      name: dto.title,
      artworkUrl: dto.artwork_url,
      duration: dto.duration,
      releaseDate: new Date(dto.created_at),
      source: "SOUNDCLOUD",
      sourceUrl: dto.permalink_url,
    })
  );

  return episodesRepo.insertMany(eps);
}
