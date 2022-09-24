import React from "react";
import { EmbedPlayer } from "../../components/EmbedPlayer";
import {
  usePlayerStore,
  PlayerStore,
  playerStoreSelectors,
} from "../PlayerStore";
import shallow from "zustand/shallow";
import Head from "next/head";
import { useEpisode } from "../TracksStore";
import { PlayerControls } from "./PlayerControls";

function Player() {
  const playerSelectors = (state: PlayerStore) => ({
    currentTrackId: state.currentTrackId,
    playing: state.playing,
    play: state.play,
    resume: state.resume,
    pause: state.pause,
    volume: state.volume,
    setVolume: state.setVolume,
    muted: playerStoreSelectors.muted(state),
    mute: state.mute,
    unmute: state.unmute,
    progress: state.progress,
    setProgress: state.setProgress,
    cuePosition: state.cuePosition,
    setCuePosition: state.setCuePosition,
    forward: state.forward,
    rewind: state.rewind,
    trackDuration: state.trackDuration,
    setTrackDuration: state.setTrackDuration,
  });

  const {
    currentTrackId,
    playing,
    resume,
    pause,
    volume,
    setVolume,
    mute,
    muted,
    unmute,
    progress,
    setProgress,
    cuePosition,
    setCuePosition,
    forward,
    rewind,
    trackDuration,
    setTrackDuration,
  } = usePlayerStore(playerSelectors, shallow);

  const currentTrack = useEpisode(currentTrackId);
  const showPlayer = currentTrack;

  return (
    <React.Fragment>
      {showPlayer && (
        <React.Fragment>
          <Head>
            <title>{currentTrack.name}</title>
          </Head>
          <div
            className="bg-white px-3 pt-3 pb-1"
            style={{
              boxShadow:
                "0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            {currentTrack.source === "MIXCLOUD" && (
              <div className="max-w-4xl m-auto">
                <EmbedPlayer track={currentTrack} />
              </div>
            )}
            {currentTrack.source === "SOUNDCLOUD" && (
              <PlayerControls
                volume={volume}
                onVolumeChange={setVolume}
                onPause={pause}
                onResume={resume}
                track={currentTrack}
                playing={playing}
                muted={muted}
                onMute={mute}
                onUnmute={unmute}
                progress={progress}
                onProgressChange={setProgress}
                cuePosition={cuePosition}
                onCuePositionChange={setCuePosition}
                onForward={forward}
                onRewind={rewind}
                trackDuration={trackDuration}
                setTrackDuration={setTrackDuration}
              />
            )}
          </div>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

export default Player;
