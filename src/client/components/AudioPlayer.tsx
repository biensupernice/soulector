import React, { useEffect, useRef, useState } from "react";

export interface AudioPlayerProps {
  mp3StreamUrl: string | null;
  playing: boolean;
  volume?: number;
  onReady: (audioDuration: number) => void;
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
  const [shouldPlay, setShouldPlay] = useState(false);

  async function onCanPlayThrough() {
    const durationSecs = ref.current?.duration ?? 0;
    const durationMillis = durationSecs * 1000;

    onReady(durationMillis);

    if (shouldPlay) {
      ref.current
        ?.play()
        .then(() => setShouldPlay(false))
        .catch((err) => console.error(`onCanPlay ${err}`));
    }
  }

  useEffect(() => {
    if (ref.current && mp3StreamUrl) {
      ref.current.src = mp3StreamUrl;
      ref.current.load();
      setShouldPlay(true);
    }

    return () => {
      ref.current?.pause();
    };
  }, [mp3StreamUrl]);

  useEffect(() => {
    if (ref.current) {
      const cuePosMillis = cuePosition ?? 0;
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
        className="block h-px scale-y-0"
        ref={ref}
        onPlay={onPlay}
        onTimeUpdate={() => {
          if (ref.current) {
            const currentTime = ref.current.currentTime;
            onPlayProgressChange(currentTime * 1000);
          }
        }}
        onPause={onPause}
        // controls
        onCanPlayThrough={onCanPlayThrough}
        // src={mp3StreamUrl}
        // autoPlay
      ></audio>
    </>
  );
}
