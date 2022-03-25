import React, { useEffect } from "react";
import { sample } from "lodash-es";
import shallow from "zustand/shallow";
import ReactGA from "react-ga";
import { usePlayerStore } from "./PlayerStore";
import { useTracksStore } from "./TracksStore";
import { inferQueryOutput, trpc } from "@/utils/trpc";

type ITrack = inferQueryOutput<"episodes.all">[number];
export function useEpisodes() {
  return trpc.useQuery(["episodes.all"]);
}

export function useEpisode(id: string | undefined) {
  const { data: queryRes } = trpc.useQuery(["episodes.all"], {
    select: (episodes) => {
      return episodes.filter((t) => t._id === id);
    },
  });

  if (!id) {
    return null;
  }

  return queryRes?.[0] || null;
}

export function useSearchEpisodes(searchText: string) {
  return trpc.useQuery(["episodes.all"], {
    select: (episodes) => {
      if (!searchText) {
        return episodes;
      }

      return episodes.filter((e) =>
        e.name.toLowerCase().includes(searchText.toLowerCase())
      );
    },
  });
}

// export const useTodosQuery = (select) =>
//   useQuery(["todos"], fetchTodos, { select });

// export const useTodosCount = () => useTodosQuery((data) => data.length);
// export const useTodo = (id) =>
//   useTodosQuery((data) => data.find((todo) => todo.id === id));

export function useTracksScreenContainer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const play = usePlayerStore((state) => state.play);

  const { data: episodes } = useEpisodes();

  function onTrackClick(episodeId: string) {
    if (episodes) {
      const episode = episodes.find((e) => e._id === episodeId);
      ReactGA.event({
        category: "User",
        action: "Track Click",
        label: episode && episode.name ? episode.name : episodeId,
      });
      play(episodeId);
    }
  }

  function onRandomClick() {
    ReactGA.event({
      category: "Action",
      action: "Play Random",
    });

    let episode = sample(episodes);
    if (episode) {
      play(episode._id);
    }
  }

  return {
    currentTrackId,
    onTrackClick,
    onRandomClick,
  };
}
