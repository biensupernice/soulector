import { trpc } from "@/utils/trpc";
import { sample } from "lodash-es";
import { event } from "nextjs-google-analytics";
import { usePlayerActions, usePlayerStore } from "./PlayerStore";
import { useEpisodes } from "./TracksStore";
import { useCustomMutation } from "../infra/useCustomMutation";
import { useEpisodeModalSheetActions } from "./EpisodeModalSheet";
import { useCollectiveSelectStore } from "./Navbar";

export function useTracksScreenContainer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const playing = usePlayerStore((state) => state.playing);
  const volume = usePlayerStore((state) => state.volume);
  const currentTrackStreamUrls = usePlayerStore(
    (state) => state.currentTrackStreamUrls
  );

  const selectedCollective = useCollectiveSelectStore((s) => s.selected);

  const playerActions = usePlayerActions();

  const { data: episodes } = useEpisodes();

  const { mutate } = usePlayEpisodeMutation();
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  async function onTrackClick(episodeId: string) {
    if (episodes) {
      const episode = episodes.find((e) => e._id === episodeId);
      event("Track Click", {
        category: "User",
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
    event("Play Random", {
      category: "Action",
    });

    let eps = episodes;
    if (selectedCollective !== "all") {
      eps = episodes?.filter((e) => e.collective_slug === selectedCollective);
    }

    let episode = sample(eps);
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

export const playEpisodeMutationKey = {
  queryKey: ["playEpisode"],
};

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
