import { trpc } from "@/utils/trpc";
import { sample } from "lodash-es";
import { event } from "nextjs-google-analytics";
import { usePlayerActions, usePlayerStore } from "./PlayerStore";
import { useEpisodes } from "./useEpisodeHooks";
import { useCustomMutation } from "../infra/useCustomMutation";
import { useEpisodeModalSheetActions } from "./EpisodeModalSheet";
import { useCollectiveSelectStore } from "./Navbar";

export function useEpisodesScreenState() {
  const currentEpisodeId = usePlayerStore((state) => state.currentEpisodeId);
  const playing = usePlayerStore((state) => state.playing);
  const volume = usePlayerStore((state) => state.volume);
  const currentEpisodeStreamUrls = usePlayerStore(
    (state) => state.currentEpisodeStreamUrls
  );

  const selectedCollective = useCollectiveSelectStore((s) => s.selected);

  const playerActions = usePlayerActions();

  const { data: episodes } = useEpisodes();

  const { mutate } = usePlayEpisodeMutation();
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  async function onEpisodeClick(episodeId: string) {
    if (episodes) {
      const episode = episodes.find((e) => e.id === episodeId);
      event("Track Click", {
        category: "User",
        label: episode && episode.name ? episode.name : episodeId,
      });

      episodeModalSheetActions.open();
      playerActions.loadEpisode(episodeId);

      mutate(episodeId, {
        onSuccess(data) {
          if (data) {
            playerActions.setCurrentEpisodeStreamUrls(data);
          }
        },
      });
    }
  }

  function onRandomClick() {
    event("Play Random", {
      category: "Action",
    });

    let eps = episodes;
    if (selectedCollective !== "all") {
      eps = episodes?.filter((e) => e.collectiveSlug === selectedCollective);
    }

    let episode = sample(eps);
    if (episode) {
      playerActions.loadEpisode(episode.id);
      episodeModalSheetActions.open();
      mutate(episode.id, {
        onSuccess(data) {
          if (data) {
            playerActions.setCurrentEpisodeStreamUrls(data);
          }
        },
      });
    }
  }

  return {
    playing,
    volume,
    currentEpisodeId,
    onEpisodeClick,
    onRandomClick,
    currentEpisodeStreamUrls,
  };
}

export function usePlayEpisodeMutation() {
  const utils = trpc.useUtils();
  const fetchStreamUrl = utils["episode.getStreamUrl"].fetch;

  return useCustomMutation(
    playEpisodeMutationKey.queryKey,
    async (episodeId: string) => {
      const query = await fetchStreamUrl(
        {
          episodeId: episodeId,
        },

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

export const playEpisodeMutationKey = {
  queryKey: ["playEpisode"],
};
