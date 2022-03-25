import React, { useEffect } from "react";
import { usePlayerStore } from "../PlayerStore";
import { useTracksStore } from "../TracksStore";
import { sample } from "lodash-es";
import { useEpisode, useEpisodes } from "../TracksScreenContainer";

export function usePlayerContainer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const playing = usePlayerStore((state) => state.playing);
  const play = usePlayerStore((state) => state.play);
  // const tracks = useTracksStore((state) => state.tracks);
  // const fetchTracksState = useTracksStore((state) => state.fetchTracksState);
  const findTrackById = useTracksStore((state) => state.findById);

  const { data: episodes, status } = useEpisodes();
  const currentTrack = useEpisode(currentTrackId);
  // const currentTrack = currentTrackId ? findTrackById(currentTrackId) : null;
  const showPlayer =
    status !== "loading" &&
    episodes &&
    episodes.length > 0 &&
    currentTrack &&
    playing;

  useEffect(() => {
    if (status === "success") {
      const episode = sample(episodes);
      episode && play(episode._id);
    }
  }, [status]);

  return {
    currentTrack,
    showPlayer,
    playing,
    play,
  };
}
