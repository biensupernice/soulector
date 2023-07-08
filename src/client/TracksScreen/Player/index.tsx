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
import { MiniPlayerControls } from "./MiniPlayerControls";
import { SoundCloudPlayer } from "@/client/components/SoundCloudPlayer";
import { useMedia } from "@/client/infra/useMedia";
import { useEpisodeModalSheetActions } from "../EpisodeModalSheet";
import classNames from "classnames";

export const USE_NEW_PLAYER = true;

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
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  function onSoundCloudPlayerReady(trackDuration: number) {
    playerActions.setLoadingStatus("loaded");
    playerActions.setTrackDuration(trackDuration);
  }

  const currentTrack = useGetEpisode(currentTrackId);

  function onSoundCloudAudioProgress(progress: number) {
    playerActions.setProgress(progress);
  }

  function onMiniPlayerClick() {
    episodeModalSheetActions.open();
  }

  const isSouncCloudSrc = currentTrack.source === "SOUNDCLOUD";

  const isBiggerScreen = useMedia("(min-width: 768px)");

  const preferMiniPlayer = true;
  const showEmbed = !isBiggerScreen && !preferMiniPlayer && isSouncCloudSrc;

  const showMini = !isBiggerScreen && preferMiniPlayer && isSouncCloudSrc;
  const showFullControls = isBiggerScreen && isSouncCloudSrc;

  return (
    <>
      <Head>
        <title>{currentTrack.name}</title>
      </Head>
      <div
        className={classNames(
          "bg-white",
          !showMini &&
            "w-full border border-t-gray-200 bg-white px-3 py-3",
          showMini && "h-0"
        )}
      >
        {currentTrack.source === "MIXCLOUD" && (
          <div className="m-auto max-w-4xl">
            <EmbedPlayer track={currentTrack} />
          </div>
        )}
        {!USE_NEW_PLAYER && (
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
        )}
        {showFullControls && (
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
      {showMini && (
        <MiniPlayerControls
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
          onClick={onMiniPlayerClick}
          loading={loadingStatus === "loading"}
        />
      )}
    </>
  );
}
