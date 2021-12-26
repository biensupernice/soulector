import React, { useEffect } from "react";
import { sample } from "lodash-es";
import shallow from "zustand/shallow";
import ReactGA from "react-ga";
import { usePlayerStore } from "./PlayerStore";
import { useTracksStore } from "./TracksStore";

export function useTracksScreenContainer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const play = usePlayerStore((state) => state.play);

  const tracks = useTracksStore((state) => state.tracks);
  const fetchTracks = useTracksStore((state) => state.fetchTracks);
  const [fetchTracksState, fetchTracksErr] = useTracksStore(
    (state) => [state.fetchTracksState, state.rejectionReason],
    shallow
  );

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  function onTrackClick(trackId: string) {
    const track = tracks.find((t) => t.id === trackId);
    ReactGA.event({
      category: "User",
      action: "Track Click",
      label: track && track.name ? track.name : trackId,
    });
    play(trackId);
  }

  function onRandomClick() {
    ReactGA.event({
      category: "Action",
      action: "Play Random",
    });

    let track = sample(tracks);
    if (track) {
      play(track.id);
    }
  }

  return {
    currentTrackId,
    onTrackClick,
    onRandomClick,
    activate: fetchTracksState,
    fetchTracksErr,
    tracks,
  };
}
