import React, { useEffect, useRef } from "react";
import type Hls from "hls.js";

export interface AudioPlayerProps {
  mp3StreamUrl: string | null;
  playing: boolean;
  volume?: number;
  onReady: (audioDuration: number) => void;
  onPlayProgressChange: (position: number) => void;
  onPause: () => void;
  onPlay: () => void;
  onEnded?: () => void;
  cuePosition?: number;
}

function isHlsUrl(url: string) {
  return /\.m3u8($|\?)/i.test(url);
}

/**
 * Safari (and every iOS browser) plays HLS off a plain `src`, and does it
 * better than we can — hardware decoding, correct behaviour in the background.
 * Everywhere else the element rejects an .m3u8 outright and we have to feed it
 * segments through Media Source Extensions instead.
 */
function canPlayHlsNatively(audio: HTMLAudioElement) {
  return audio.canPlayType("application/vnd.apple.mpegurl") !== "";
}

export function AudioPlayer({
  mp3StreamUrl,
  onReady,
  playing,
  onPlayProgressChange,
  onPause,
  onPlay,
  onEnded,
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

    // play() waits for enough data on its own, so playback starts the moment
    // the browser can, instead of waiting for the canplaythrough estimate.
    const startPlaying = () =>
      audio.play().catch((err) => console.error(`audio play failed: ${err}`));

    // Not every source is HLS: Mixcloud archives, the local source and the
    // test stream are all still plain progressive MP3, and handing those to
    // hls.js would only break them.
    if (!isHlsUrl(mp3StreamUrl) || canPlayHlsNatively(audio)) {
      audio.src = mp3StreamUrl;
      audio.load();
      startPlaying();

      return () => {
        audio.pause();
      };
    }

    // hls.js is a few hundred kilobytes and is dead weight on Safari and on
    // every progressive episode, so it is only fetched once a browser that
    // needs it actually plays an HLS stream.
    let hls: Hls | null = null;
    let cancelled = false;

    import("hls.js").then(({ default: HlsCtor }) => {
      // The episode changed (or the player unmounted) while the chunk was in
      // flight; anything we attach now attaches to a dead element.
      if (cancelled || !HlsCtor.isSupported()) {
        if (!cancelled && !HlsCtor.isSupported()) {
          console.error("HLS playback is not supported in this browser");
        }
        return;
      }

      hls = new HlsCtor();
      hls.loadSource(mp3StreamUrl);
      hls.attachMedia(audio);
      hls.on(HlsCtor.Events.MANIFEST_PARSED, startPlaying);
      hls.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error(`hls fatal error: ${data.type} / ${data.details}`);
        }
      });
    });

    return () => {
      cancelled = true;
      audio.pause();
      // Without this the old instance keeps pulling segments in the
      // background and holds its source buffers, so switching episodes leaks
      // a download and a few tens of megabytes each time.
      hls?.destroy();
      hls = null;
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
      onEnded={onEnded}
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
