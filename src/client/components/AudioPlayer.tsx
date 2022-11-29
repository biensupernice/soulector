import React, { useEffect, useRef } from "react";

export interface AudioPlayerProps {
  mp3StreamUrl: string | null;
  playing: boolean;
  volume?: number;
  onReady: (trackDuration: number) => void;
  onPlayProgressChange: (position: number) => void;
  onPause: () => void;
  onPlay: () => void;
  cuePosition?: number;
}
export function AudioPlayer({
  mp3StreamUrl,
  onReady,
  playing,
  onPlayProgressChange,
  onPause,
  onPlay,
  volume = 100,
  cuePosition,
}: AudioPlayerProps) {
  const ref = useRef<HTMLAudioElement>(null);

  async function onCanPlayThrough() {
    const durationSecs = ref.current?.duration ?? 0;
    const durationMillis = durationSecs * 1000;
    console.log("onCanPlay", durationSecs);

    onReady(durationMillis);

    if (playing) {
      ref.current
        ?.play()
        .then()
        .catch((err) => console.error(`onCanPlay ${err}`));
    }
  }

  function onPressPlay() {
    ref.current?.play();
  }

  useEffect(() => {
    console.log("mp3StreamUrl effect", ref.current, mp3StreamUrl);
    if (ref.current && mp3StreamUrl) {
      ref.current.src = mp3StreamUrl;
      ref.current.load();
    }

    return () => {
      ref.current?.pause();
    };
  }, [mp3StreamUrl]);

  useEffect(() => {
    if (ref.current) {
      const cuePosMillis = cuePosition ?? 0;
      console.log("currentTime", ref.current.currentTime);
      console.log("cuePosition", cuePosition);
      console.log("cuePosMillis", cuePosMillis);
      ref.current.currentTime = cuePosMillis / 1000;
    }
  }, [cuePosition]);

  useEffect(() => {
    if (ref.current) {
      if (playing) {
        ref.current.play();
      } else {
        ref.current.pause();
      }
    }
  }, [playing]);

  useEffect(() => {
    if (ref.current) {
      ref.current.volume = volume / 100;
    }
  }, [volume]);

  return (
    <>
      <audio
        // key={mp3StreamUrl}
        ref={ref}
        onPlay={onPlay}
        onTimeUpdate={() => {
          if (ref.current) {
            const currentTime = ref.current.currentTime;
            onPlayProgressChange(currentTime * 1000);
          }
        }}
        onPause={onPause}
        controls
        onCanPlayThrough={onCanPlayThrough}
        // src={mp3StreamUrl}
        // autoPlay
      ></audio>
      <button onClick={onPressPlay}>Play</button>
    </>
  );
}
