import { trpc } from "@/utils/trpc";
import { sample } from "lodash-es";
import ReactGA from "react-ga";
import { usePlayerActions, usePlayerStore } from "./PlayerStore";
import { useEpisodes } from "./TracksStore";
import { useCustomMutation } from "../infra/useCustomMutation";
import { useEpisodeModalSheetActions } from "./EpisodeModalSheet";

export function useTracksScreenContainer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const playing = usePlayerStore((state) => state.playing);
  const volume = usePlayerStore((state) => state.volume);
  const currentTrackStreamUrls = usePlayerStore(
    (state) => state.currentTrackStreamUrls
  );

  const playerActions = usePlayerActions();

  const { data: episodes } = useEpisodes();

  const { mutate } = usePlayEpisodeMutation();
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  async function onTrackClick(episodeId: string) {
    if (episodes) {
      const episode = episodes.find((e) => e._id === episodeId);
      ReactGA.event({
        category: "User",
        action: "Track Click",
        label: episode && episode.name ? episode.name : episodeId,
      });

      episodeModalSheetActions.open();
      playerActions.loadTrack(episodeId);

      mutate(episodeId, {
        onSuccess(data) {
          if (data) {
            playerActions.setCurrentTrackStreamUrls(data);
          }
        },
      });
    }
  }

  function onRandomClick() {
    ReactGA.event({
      category: "Action",
      action: "Play Random",
    });

    let episode = sample(episodes);
    if (episode) {
      playerActions.loadTrack(episode._id);
      episodeModalSheetActions.open();
      mutate(episode._id, {
        onSuccess(data) {
          if (data) {
            playerActions.setCurrentTrackStreamUrls(data);
          }
        },
      });
    }
  }

  return {
    playing,
    volume,
    currentTrackId,
    onTrackClick,
    onRandomClick,
    currentTrackStreamUrls,
  };
}

export function usePlayEpisodeMutation() {
  const { fetchQuery } = trpc.useContext();
  return useCustomMutation(
    "playEpisode",
    async (episodeId: string) => {
      const query = await fetchQuery(
        [
          "episode.getStreamUrl",
          {
            episodeId: episodeId,
          },
        ],
        {
          staleTime: Infinity,
        }
      );

      return query;
    },
    {
      onError: (err, va) => console.error(err, va),
    }
  );
}
