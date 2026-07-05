import React, { useEffect, useRef } from "react";

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

  // Duration is known as soon as metadata arrives, well before enough audio
  // has buffered to fire canplaythrough. Reporting ready here lets the UI
  // (and any initial track seek) settle while the audio is still buffering.
  function onLoadedMetadata() {
    const durationSecs = ref.current?.duration ?? 0;
    onReady(durationSecs * 1000);
  }

  useEffect(() => {
    const audio = ref.current;
    if (!audio || !mp3StreamUrl) {
      return;
    }

    audio.preload = "auto";
    audio.src = mp3StreamUrl;
    audio.load();
    // play() waits for enough data on its own, so playback starts the moment
    // the browser can, instead of waiting for the canplaythrough estimate.
    audio.play().catch((err) => console.error(`audio play failed: ${err}`));

    return () => {
      audio.pause();
    };
  }, [mp3StreamUrl]);

  useEffect(() => {
    const audio = ref.current;
    // Never seek an element without a source: it would throw away the seek
    // and, worse, a stale cuePosition must not touch a tearing-down player.
    if (audio && audio.currentSrc) {
      const cuePosMillis = cuePosition ?? 0;
      audio.currentTime = cuePosMillis / 1000;
    }
  }, [cuePosition]);

  useEffect(() => {
    const audio = ref.current;
    if (audio && audio.currentSrc) {
      if (playing) {
        audio.play().catch((err) => console.error(`audio play failed: ${err}`));
      } else {
        audio.pause();
      }
    }
  }, [playing]);

  useEffect(() => {
    if (ref.current) {
      ref.current.volume = volume / 100;
    }
  }, [volume]);

  return (
    <audio
      className="block h-px scale-y-0"
      ref={ref}
      onPlay={onPlay}
      onPause={onPause}
      onLoadedMetadata={onLoadedMetadata}
      onTimeUpdate={() => {
        if (ref.current) {
          const currentTime = ref.current.currentTime;
          onPlayProgressChange(currentTime * 1000);
        }
      }}
    ></audio>
  );
}
