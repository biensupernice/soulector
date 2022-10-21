import React, { useEffect, useRef } from "react";
import { EmbedPlayer } from "../../components/EmbedPlayer";
import {
  usePlayerStore,
  PlayerStore,
  playerStoreSelectors,
} from "../PlayerStore";
import shallow from "zustand/shallow";
import Head from "next/head";
import { useEpisode, useEpisodeStreamUrls } from "../TracksStore";
import { PlayerControls } from "./PlayerControls";
import { SoundCloudPlayer } from "@/client/components/SoundCloudPlayer";
import { useMedia } from "@/client/infra/useMedia";

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
    loadingStatus: state.loadingStatus,
    setLoadingStatus: state.setLoadingStatus,
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
    loadingStatus,
    setLoadingStatus,
  } = usePlayerStore(playerSelectors, shallow);

  function onSoundCloudPlayerReady(trackDuration: number) {
    setLoadingStatus("loaded");
    setTrackDuration(trackDuration);
  }

  const currentTrack = useEpisode(currentTrackId);
  const streamUrls = useEpisodeStreamUrls(currentTrackId);
  const showPlayer = currentTrack;

  function onSoundCloudAudioProgress(progress: number) {
    setProgress(progress);
  }

  function onAudioPlayerReady(duration: number) {
    console.log("onAudioPlayerReady", duration, playing);
  }

  const isMed = useMedia("(min-width: 768px)");
  const showEmbed = !isMed;

  return (
    <React.Fragment>
      {showPlayer && (
        <React.Fragment>
          <Head>
            <title>{currentTrack.name}</title>
          </Head>
          <div className="border border-t-gray-200 bg-white px-3 pt-3 pb-1">
            {currentTrack.source === "MIXCLOUD" && (
              <div className="m-auto max-w-4xl">
                <EmbedPlayer track={currentTrack} />
              </div>
            )}
            {currentTrack.source === "SOUNDCLOUD" && (
              <>
                {/* <SoundCloudPlayer
                  key={currentTrack._id}
                  onReady={onSoundCloudPlayerReady}
                  showNative={showEmbed}
                  track={currentTrack}
                  position={cuePosition}
                  playing={playing}
                  volume={volume}
                  onPlayProgressChange={onSoundCloudAudioProgress}
                /> */}

                {streamUrls && streamUrls.data ? (
                  <AudioPlayer
                    onReady={onAudioPlayerReady}
                    mp3StreamUrl={streamUrls.data.http_mp3_128_url}
                  />
                ) : null}
              </>
            )}
            {currentTrack.source === "SOUNDCLOUD" && !showEmbed && (
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
                onCuePositionChange={setCuePosition}
                onForward={forward}
                onRewind={rewind}
                trackDuration={trackDuration}
                loading={loadingStatus === "loading"}
              />
            )}
          </div>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

interface AudioPlayerProps {
  mp3StreamUrl: string;
  onReady: (trackDuration: number) => void;
}
export function AudioPlayer({ mp3StreamUrl, onReady }: AudioPlayerProps) {
  const ref = useRef<HTMLAudioElement>(null);

  async function onCanPlayThrough() {
    const durationSecs = ref.current?.duration ?? 0;
    const durationMillis = durationSecs * 1000;
    console.log("onCanPlay", durationSecs);
    onReady;

    onReady(durationMillis);
    // ref.current
    //   ?.play()
    //   .then()
    //   .catch((err) => console.error(`onCanPlay ${err}`));
  }

  function onPlay() {
    ref.current?.play();
  }

  useEffect(() => {
    console.log("effect", ref.current, mp3StreamUrl);
    if (ref.current) {
      ref.current.src = mp3StreamUrl;
      ref.current.load();
    }

    return () => {
      ref.current?.pause();
    };
  }, [mp3StreamUrl]);

  return (
    <>
      <audio
        // key={mp3StreamUrl}
        ref={ref}
        // src={mp3StreamUrl}
        controls
        onCanPlayThrough={onCanPlayThrough}
        autoPlay
      ></audio>
      <button onClick={onPlay}>Play</button>
    </>
  );
}

export default Player;
