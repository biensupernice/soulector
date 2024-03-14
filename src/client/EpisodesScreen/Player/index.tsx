import React from "react";
import { EmbedPlayer } from "../../components/EmbedPlayer";
import {
  usePlayerActions,
  usePlayerPlaying,
  usePlayerVolume,
  usePlayerMuted,
  usePlayerProgress,
  usePlayerCuePosition,
  usePlayerEpisodeDuration,
  usePlayerLoadingStatus,
} from "../PlayerStore";
import Head from "next/head";
import { useGetEpisode } from "../useEpisodeHooks";
import { PlayerControls } from "./PlayerControls";
import { MiniPlayerControls } from "./MiniPlayerControls";
import { SoundCloudPlayer } from "@/client/components/SoundCloudPlayer";
import { useMedia } from "@/client/infra/useMedia";
import { useEpisodeModalSheetActions } from "../EpisodeModalSheet";
import classNames from "classnames";

export const USE_NEW_PLAYER = true;

export interface PlayerProps {
  currentEpisodeId: string;
}
export default function Player({ currentEpisodeId }: PlayerProps) {
  const playing = usePlayerPlaying();
  const volume = usePlayerVolume();
  const muted = usePlayerMuted();
  const progress = usePlayerProgress();
  const cuePosition = usePlayerCuePosition();
  const episodeDuration = usePlayerEpisodeDuration();
  const loadingStatus = usePlayerLoadingStatus();

  const playerActions = usePlayerActions();
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  function onSoundCloudPlayerReady(audioDuration: number) {
    playerActions.setLoadingStatus("loaded");
    playerActions.setEpisodeDuration(audioDuration);
  }

  const currentEpisode = useGetEpisode(currentEpisodeId);

  function onSoundCloudAudioProgress(progress: number) {
    playerActions.setProgress(progress);
  }

  function onMiniPlayerClick() {
    episodeModalSheetActions.open();
  }

  const isSouncCloudSrc = currentEpisode.source === "SOUNDCLOUD";

  const isBiggerScreen = useMedia("(min-width: 768px)");

  const preferMiniPlayer = true;
  const showEmbed = !isBiggerScreen && !preferMiniPlayer && isSouncCloudSrc;

  const showMini = !isBiggerScreen && preferMiniPlayer && isSouncCloudSrc;
  const showFullControls = isBiggerScreen && isSouncCloudSrc;

  return (
    <>
      <Head>
        <title>{currentEpisode.name}</title>
      </Head>
      <div
        className={classNames(
          "bg-white",
          !showMini && "w-full border border-t-gray-200 bg-white px-3 py-3",
          showMini && "h-0"
        )}
      >
        {currentEpisode.source === "MIXCLOUD" && (
          <div className="m-auto max-w-4xl">
            <EmbedPlayer episode={currentEpisode} />
          </div>
        )}
        {!USE_NEW_PLAYER && (
          <SoundCloudPlayer
            key={currentEpisode.id}
            onReady={onSoundCloudPlayerReady}
            showNative={showEmbed}
            episode={currentEpisode}
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
            episode={currentEpisode}
            playing={playing}
            muted={muted}
            onMute={playerActions.mute}
            onUnmute={playerActions.unmute}
            progress={progress}
            onCuePositionChange={playerActions.setCuePosition}
            onForward={playerActions.forward}
            onRewind={playerActions.rewind}
            episodeDuration={episodeDuration}
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
          episode={currentEpisode}
          playing={playing}
          muted={muted}
          onMute={playerActions.mute}
          onUnmute={playerActions.unmute}
          progress={progress}
          onCuePositionChange={playerActions.setCuePosition}
          onForward={playerActions.forward}
          onRewind={playerActions.rewind}
          episodeDuration={episodeDuration}
          onClick={onMiniPlayerClick}
          loading={loadingStatus === "loading"}
        />
      )}
    </>
  );
}
