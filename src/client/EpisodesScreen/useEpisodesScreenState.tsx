import { trpc } from "@/utils/trpc";
import { sample } from "lodash-es";
import { event } from "nextjs-google-analytics";
import { usePlayerActions, usePlayerStore } from "./PlayerStore";
import { useRadioStore } from "./RadioStore";
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
      // Picking an episode by hand takes over from the radio broadcast.
      useRadioStore.getState().actions.tuneOut();

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
            playerActions.setCurrentEpisodeStreamUrls(episodeId, data);
          }
        },
      });
    }
  }

  async function onTrackClick(episodeId: string, timestampSecs?: number) {
    if (episodes) {
      useRadioStore.getState().actions.tuneOut();

      const episode = episodes.find((e) => e.id === episodeId);
      event("Track Search Play", {
        category: "User",
        label: episode && episode.name ? episode.name : episodeId,
      });

      episodeModalSheetActions.open();
      playerActions.loadEpisode(
        episodeId,
        timestampSecs !== undefined ? timestampSecs * 1000 : undefined,
      );

      mutate(episodeId, {
        onSuccess(data) {
          if (data) {
            playerActions.setCurrentEpisodeStreamUrls(episodeId, data);
          }
        },
      });
    }
  }

  function onRandomClick() {
    useRadioStore.getState().actions.tuneOut();

    event("Play Random", {
      category: "Action",
    });

    let eps = episodes;
    if (selectedCollective !== "all") {
      eps = episodes?.filter((e) => e.collectiveSlug === selectedCollective);
    }

    let episode = sample(eps);
    if (episode) {
      const episodeId = episode.id;
      playerActions.loadEpisode(episodeId);
      episodeModalSheetActions.open();
      mutate(episodeId, {
        onSuccess(data) {
          if (data) {
            playerActions.setCurrentEpisodeStreamUrls(episodeId, data);
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
    onTrackClick,
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
