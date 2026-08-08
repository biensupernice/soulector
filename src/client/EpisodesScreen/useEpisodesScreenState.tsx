import { trpc } from "@/utils/trpc";
import { sample } from "lodash-es";
import { event } from "../analytics";
import { usePlayerActions, usePlayerStore } from "./PlayerStore";
import { useRadioStore } from "./RadioStore";
import { useEpisodes } from "./useEpisodeHooks";
import { useCustomMutation } from "../infra/useCustomMutation";
import { useEpisodeModalSheetActions } from "./EpisodeModalSheet";
import { useCollectiveSelectStore } from "./Navbar";
import { useTracksPanelStore } from "./TracksPanelStore";

export function useEpisodesScreenState() {
  const currentEpisodeId = usePlayerStore((state) => state.currentEpisodeId);
  const playing = usePlayerStore((state) => state.playing);
  const volume = usePlayerStore((state) => state.volume);
  const currentEpisodeStreamUrls = usePlayerStore(
    (state) => state.currentEpisodeStreamUrls,
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
      // Picking a set shows its cue sheet. The records that go somewhere are
      // marked in there, and a panel behind a hover-hidden chevron hid them.
      useTracksPanelStore.getState().actions.open(episodeId);

      mutate(episodeId);
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

      mutate(episodeId);
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
      useTracksPanelStore.getState().actions.open(episodeId);
      mutate(episodeId);
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
        },
      );

      // Handing the urls to the player here rather than in a caller's
      // onSuccess: those callbacks belong to the component that fired the
      // mutation, and a move that swaps episodes can unmount it before the
      // request lands — which left the new episode loaded but silent.
      if (query) {
        usePlayerStore
          .getState()
          .actions.setCurrentEpisodeStreamUrls(episodeId, query);
      }

      return query;
    },
    {
      onError: (err, va) => console.error(err, va),
    },
  );
}

export const playEpisodeMutationKey = {
  queryKey: ["playEpisode"],
};
