import React, { useState, useEffect, useRef, useMemo } from "react";
import { SoundCloudPlayer } from "../../components/SoundCloudPlayer";
import { formatDate, formatTime } from "../../helpers";
import {
  IconPause,
  IconPlay,
  IconBackThirty,
  IconSkipThirty,
  IconSoundcloud,
  IconSpeaker,
} from "../../components/Icons";
import cx from "classnames";
import { useMedia } from "../../infra/useMedia";
import { ITrack } from "../TracksStore";
import { Slider } from "@/client/components/Slider";

type PlayerControlsProps = {
  track: ITrack;
  playing: boolean;
  volume: number;
  onVolumeChange: (vol: number) => void;
  onResume: () => void;
  onPause: () => void;
  muted: boolean;
  onMute: () => void;
  onUnmute: () => void;
  progress: number;
  onProgressChange: (progress: number) => void;
  cuePosition: number;
  onCuePositionChange: (cuePos: number) => void;
  onForward: (secs: number) => void;
  onRewind: (secs: number) => void;
  trackDuration: number;
  setTrackDuration: (duration: number) => void;
};
export function PlayerControls({
  track,
  playing,
  onPause,
  onResume,
  volume,
  onVolumeChange,
  muted,
  onMute,
  onUnmute,
  progress,
  onProgressChange,
  cuePosition,
  onCuePositionChange,
  onForward,
  onRewind,
  trackDuration,
  setTrackDuration,
}: PlayerControlsProps) {
  const [debug] = useState(false);

  const isMed = useMedia("(min-width: 768px)");

  const lastSeekPos = useRef(0);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(playerProgress);

  function onPlayerReady(trackDuration: number) {
    setPlayerReady(true);
    setTrackDuration(trackDuration);
    setPlayerProgress(0);
  }

  const scrubberProgress = seeking ? seekPosition : playerProgress;

  // TODO: Remove when mobile player done
  const useEmbed = useMemo(() => {
    return debug || !isMed;
  }, [isMed, debug]);

  function onAudioProgress(progress: number) {
    if (!seeking) {
      setPlayerProgress(progress);
      onProgressChange(progress);
    }
  }

  useEffect(() => {
    setPlayerProgress(0);
    onCuePositionChange(0);
  }, [track, onCuePositionChange]);

  return (
    <React.Fragment>
      {playerReady && (
        <div
          className={cx("grid grid-cols-3 gap-5 xl:grid-cols-10", {
            hidden: useEmbed,
          })}
        >
          <div className="flex items-center space-x-3 xl:col-span-2 ">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
              <img
                className="h-full w-full bg-gray-200"
                src={track.picture_large}
                alt={track.name}
              />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-md font-bold leading-tight">
                {track.name}
              </div>
              <div className="text-md text-gray-700">
                {formatDate(track.created_time)}
              </div>
            </div>
          </div>
          {/* Player */}
          <div className="flex flex-col items-center justify-center space-y-1 xl:col-span-6">
            <div className="flex items-center justify-center space-x-4">
              <button
                title="Rewind 30 seconds"
                onClick={() => onRewind(30)}
                className={cx(
                  "rounded-full bg-transparent p-2 text-gray-700",
                  "transition-all duration-200 ease-in-out",
                  "hover:text-gray-900",
                  "focus:bg-gray-200 focus:outline-none"
                )}
              >
                <IconBackThirty className="h-8 w-8 fill-current" />
              </button>
              <button
                onClick={() => (playing ? onPause() : onResume())}
                className={cx(
                  "rounded-full border bg-indigo-600 p-2 leading-none text-white shadow-md",
                  "transition-all duration-200 ease-in-out",
                  "hover:bg-indigo-700 hover:shadow-lg",
                  "focus:bg-indigo-700 focus:outline-none"
                )}
              >
                {playing ? (
                  <IconPause className="inline-block h-8 w-8 fill-current" />
                ) : (
                  <IconPlay className="inline-block h-8 w-8 fill-current" />
                )}
              </button>
              <button
                title="Forward 30 seconds"
                onClick={() => onForward(30)}
                className={cx(
                  "rounded-full bg-transparent p-2 text-gray-700",
                  "transition-all duration-200 ease-in-out",
                  "hover:text-gray-900",
                  "focus:bg-gray-200 focus:outline-none"
                )}
              >
                <IconSkipThirty className="h-8 w-8 fill-current" />
              </button>
            </div>
            <div className="w-full max-w-3xl">
              <>
                <div className="flex items-center justify-center">
                  <div className="w-10 text-right text-xs">
                    {formatTime(Math.ceil(scrubberProgress))}
                  </div>
                  <div className="relative mx-3 flex w-full max-w-xl flex-1 flex-col justify-center">
                    <Slider
                      aria-label="progress"
                      minValue={0}
                      maxValue={trackDuration}
                      value={scrubberProgress}
                      onChange={(val) => {
                        setSeeking(true);
                        const newVal = Array.isArray(val) ? val[0] : val;
                        setSeekPosition(newVal);
                        lastSeekPos.current = newVal;
                      }}
                      onChangeEnd={(val) => {
                        const newVal = Array.isArray(val) ? val[0] : val;
                        setSeeking(false);
                        setPlayerProgress(newVal);
                        onCuePositionChange(lastSeekPos.current);
                      }}
                    />
                  </div>
                  <div className="w-10 text-xs">
                    {formatTime(Math.ceil(trackDuration))}
                  </div>
                </div>
              </>
            </div>
          </div>
          {/* Volume */}
          <div className="flex items-center justify-end space-x-2 xl:col-span-2">
            <div className="flex items-center space-x-1">
              <a
                className={cx(
                  "inline-block rounded-full p-2",
                  "transition-all duration-200 ease-in-out",
                  "hover:bg-gray-200 "
                )}
                title="Open in SoundCloud"
                target="_blank"
                rel="noopener noreferrer"
                href={track.url}
              >
                <IconSoundcloud className="h-5 w-5 fill-current" />
              </a>
              <div className="flex items-center space-x-1">
                <button
                  className={cx(
                    "inline-block rounded-full p-1",
                    "transition-all duration-200 ease-in-out",
                    "hover:bg-gray-200",
                    "focus:outline-none"
                  )}
                  title={muted ? "Unmute" : "Mute"}
                  onClick={() => {
                    muted ? onUnmute() : onMute();
                  }}
                >
                  <IconSpeaker className="h-5 w-5 fill-current" />
                </button>
                <div className="w-40 pr-4">
                  <Slider
                    aria-label="volume"
                    minValue={0}
                    maxValue={100}
                    value={volume}
                    onChange={(val) => {
                      const newVal = Array.isArray(val) ? val[0] : val;
                      onVolumeChange(newVal);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <SoundCloudPlayer
        key={track._id}
        onReady={onPlayerReady}
        showNative={useEmbed}
        track={track}
        position={cuePosition}
        playing={playing}
        volume={volume}
        onPlayProgressChange={onAudioProgress}
      />
    </React.Fragment>
  );
}
