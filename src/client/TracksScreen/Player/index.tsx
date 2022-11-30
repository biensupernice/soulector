import React from "react";
import { EmbedPlayer } from "../../components/EmbedPlayer";
import {
  usePlayerActions,
  usePlayerPlaying,
  usePlayerVolume,
  usePlayerMuted,
  usePlayerProgress,
  usePlayerCuePosition,
  usePlayerTrackDuration,
  usePlayerLoadingStatus,
} from "../PlayerStore";
import Head from "next/head";
import { useGetEpisode } from "../TracksStore";
import { PlayerControls } from "./PlayerControls";
import { SoundCloudPlayer } from "@/client/components/SoundCloudPlayer";
import { useMedia } from "@/client/infra/useMedia";

export const USE_NEW_PLAYER = false;

export interface PlayerProps {
  currentTrackId: string;
}
export default function Player({ currentTrackId }: PlayerProps) {
  const playing = usePlayerPlaying();
  const volume = usePlayerVolume();
  const muted = usePlayerMuted();
  const progress = usePlayerProgress();
  const cuePosition = usePlayerCuePosition();
  const trackDuration = usePlayerTrackDuration();
  const loadingStatus = usePlayerLoadingStatus();

  const playerActions = usePlayerActions();

  function onSoundCloudPlayerReady(trackDuration: number) {
    playerActions.setLoadingStatus("loaded");
    playerActions.setTrackDuration(trackDuration);
  }

  const currentTrack = useGetEpisode(currentTrackId);

  function onSoundCloudAudioProgress(progress: number) {
    playerActions.setProgress(progress);
  }

  const isMed = useMedia("(min-width: 768px)");
  const showEmbed = !isMed;

  return (
    <div className="md-safe-bottom w-full bg-white">
      <Head>
        <title>{currentTrack.name}</title>
      </Head>
      <div className="border border-t-gray-200 bg-white px-3 pt-3 pb-1">
        {currentTrack.source === "MIXCLOUD" && (
          <div className="m-auto max-w-4xl">
            <EmbedPlayer track={currentTrack} />
          </div>
        )}
        {!USE_NEW_PLAYER && currentTrack.source === "SOUNDCLOUD" && (
          <>
            <SoundCloudPlayer
              key={currentTrack._id}
              onReady={onSoundCloudPlayerReady}
              showNative={showEmbed}
              track={currentTrack}
              position={cuePosition}
              playing={playing}
              volume={volume}
              onPlayProgressChange={onSoundCloudAudioProgress}
            />
          </>
        )}
        {currentTrack.source === "SOUNDCLOUD" && !showEmbed && (
          <PlayerControls
            volume={volume}
            onVolumeChange={playerActions.setVolume}
            onPause={playerActions.pause}
            onResume={playerActions.resume}
            track={currentTrack}
            playing={playing}
            muted={muted}
            onMute={playerActions.mute}
            onUnmute={playerActions.unmute}
            progress={progress}
            onCuePositionChange={playerActions.setCuePosition}
            onForward={playerActions.forward}
            onRewind={playerActions.rewind}
            trackDuration={trackDuration}
            loading={loadingStatus === "loading"}
          />
        )}
      </div>
    </div>
  );
}
