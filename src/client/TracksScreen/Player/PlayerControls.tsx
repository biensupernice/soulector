import React, { useState } from "react";
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
import { ITrack } from "../TracksStore";
import { Slider } from "@/client/components/Slider";
import { motion } from "framer-motion";

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
  onCuePositionChange: (cuePos: number) => void;
  onForward: (secs: number) => void;
  onRewind: (secs: number) => void;
  trackDuration: number;
  loading: boolean;
};
export function PlayerControls({
  track,
  trackDuration,
  volume,
  onVolumeChange,
  muted,
  onMute,
  playing,
  onPause,
  onResume,
  onUnmute,
  progress,
  onCuePositionChange,
  onForward,
  onRewind,
  loading,
}: PlayerControlsProps) {
  const [seeking, setSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(progress);

  const scrubberProgress = seeking ? seekPosition : progress;

  return (
    <div className={cx("grid grid-cols-3 gap-5 xl:grid-cols-10")}>
      <div className="flex items-center space-x-3 xl:col-span-2 ">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
          <img
            className="h-full w-full bg-gray-200"
            src={track.picture_large}
            alt={track.name}
          />
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-md font-bold leading-tight">{track.name}</div>
          <div className="text-md text-gray-700">
            {formatDate(track.created_time)}
          </div>
        </div>
      </div>
      {/* Player */}
      <div className="flex flex-col items-center justify-center space-y-1 xl:col-span-6">
        <div className="flex items-center justify-center space-x-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
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
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring" }}
            disabled={loading}
            onClick={() => (playing ? onPause() : onResume())}
            className={cx(
              "rounded-full border bg-indigo-600 p-2 leading-none text-white shadow-md",
              "transition-all duration-200 ease-in-out",
              "hover:bg-indigo-700 hover:shadow-lg",
              "focus:bg-indigo-700 focus:outline-none",
              loading && "cursor-not-allowed disabled:cursor-not-allowed"
            )}
          >
            {loading ? (
              <svg
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 animate-ping p-1"
              >
                <circle cx="10" cy="10" r="9" fill="currentColor" />
              </svg>
            ) : playing ? (
              <motion.div
                key="pause"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block h-8 w-8"
              >
                <IconPause className="inline-block h-8 w-8 fill-current" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block h-8 w-8"
              >
                <IconPlay className="inline-block h-8 w-8 fill-current" />
              </motion.div>
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
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
          </motion.button>
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
                  }}
                  onChangeEnd={(val) => {
                    const newVal = Array.isArray(val) ? val[0] : val;
                    setSeeking(false);
                    onCuePositionChange(newVal);
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
  );
}

interface MiniPlayerControlsPromps extends PlayerControlsProps {
  onClick(): void;
}
export function MiniPlayerControls({
  track,
  trackDuration,
  volume,
  onVolumeChange,
  muted,
  onMute,
  playing,
  onPause,
  onResume,
  onUnmute,
  progress,
  onCuePositionChange,
  onForward,
  onRewind,
  loading,
  onClick,
}: MiniPlayerControlsPromps) {
  return (
    <div className="relative grid grid-cols-10 h-full">
      <div className="absolute top-0 h-[2px] w-full bg-gray-300">
        <div
          className="absolute top-0 h-[2px] bg-indigo-600"
          style={{ width: `${(100 * progress) / trackDuration}%` }}
        ></div>
      </div>
      <button
        onClick={() => onClick()}
        className="col-span-7 flex w-full items-center space-x-2 py-3 pl-3 text-left"
      >
        <div className="relative h-11 w-11 flex-shrink-0 rounded">
          <img
            className="h-full w-full rounded bg-gray-200"
            src={track.picture_large}
            alt={track.name}
          />
        </div>
        <div className="flex w-full flex-col justify-center overflow-hidden">
          <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold leading-tight">
            {track.name}
          </div>
          <div className="text-sm text-gray-700">
            {formatDate(track.created_time)}
          </div>
        </div>
      </button>
      {/* Player */}
      <div className="col-span-3 flex h-full w-full flex-col items-end justify-center pl-1 pr-3">
        <div className="flex items-center justify-center space-x-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            title="Forward 30 seconds"
            onClick={() => onForward(30)}
            className={cx(
              "rounded-fullp-1 text-gray-700",
              "transition-all duration-200 ease-in-out",
              "hover:text-gray-900",
              "focus:bg-gray-200 focus:outline-none"
            )}
          >
            <IconSkipThirty className="h-8 w-8 fill-current" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring" }}
            disabled={loading}
            onClick={() => (playing ? onPause() : onResume())}
            className={cx(
              "rounded-fullp-1 leading-none text-gray-700",
              "transition-all duration-200 ease-in-out",
              "hover:text-gray-900",
              "focus:bg-gray-200 focus:outline-none",
              loading && "cursor-not-allowed disabled:cursor-not-allowed"
            )}
          >
            {playing ? (
              <motion.div
                key="pause"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block h-8 w-8"
              >
                <IconPause className="inline-block h-8 w-8 fill-current" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block h-8 w-8"
              >
                <IconPlay className="inline-block h-8 w-8 fill-current" />
              </motion.div>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export function MobilePlayerControls({
  track,
  trackDuration,
  volume,
  onVolumeChange,
  muted,
  onMute,
  playing,
  onPause,
  onResume,
  onUnmute,
  progress,
  onCuePositionChange,
  onForward,
  onRewind,
  loading,
}: PlayerControlsProps) {
  const [seeking, setSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(progress);

  const scrubberProgress = seeking ? seekPosition : progress;

  return (
    <div className="flex h-full flex-col items-center space-y-3 pb-4">
      <div className="flex w-full max-w-3xl flex-col">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mx-3 flex w-full max-w-xl flex-1 flex-col justify-center">
            <Slider
              showThumb
              aria-label="progress"
              minValue={0}
              maxValue={trackDuration}
              value={scrubberProgress}
              onChange={(val) => {
                setSeeking(true);
                const newVal = Array.isArray(val) ? val[0] : val;
                setSeekPosition(newVal);
              }}
              onChangeEnd={(val) => {
                const newVal = Array.isArray(val) ? val[0] : val;
                setSeeking(false);
                onCuePositionChange(newVal);
              }}
            />
          </div>
          <div className="flex w-full justify-between">
            <div className="text-right text-xs">
              {formatTime(Math.ceil(scrubberProgress))}
            </div>
            <div className="text-left text-xs">
              {formatTime(Math.ceil(trackDuration))}
            </div>
          </div>
        </div>
        <div />
      </div>
      <div className="flex items-center justify-center space-x-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          title="Rewind 30 seconds"
          onClick={() => onRewind(30)}
          className={cx(
            "rounded-full bg-transparent p-2 text-gray-700",
            "transition-all duration-200 ease-in-out",
            "hover:text-gray-900",
            "focus:bg-gray-200 focus:outline-none"
          )}
        >
          <IconBackThirty className="h-12 w-12 fill-current" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring" }}
          disabled={loading}
          onClick={() => (playing ? onPause() : onResume())}
          className={cx(
            "rounded-full border bg-indigo-600 p-4 leading-none text-white shadow-md",
            "transition-all duration-200 ease-in-out",
            "hover:bg-indigo-700 hover:shadow-lg",
            "focus:bg-indigo-700 focus:outline-none",
            loading && "cursor-not-allowed disabled:cursor-not-allowed"
          )}
        >
          {loading ? (
            <svg
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 animate-ping p-1"
            >
              <circle cx="10" cy="10" r="9" fill="currentColor" />
            </svg>
          ) : playing ? (
            <motion.div
              key="pause"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-block h-12 w-12"
            >
              <IconPause className="inline-block h-12 w-12 fill-current" />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-block h-12 w-12"
            >
              <IconPlay className="inline-block h-12 w-12 fill-current" />
            </motion.div>
          )}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          title="Forward 30 seconds"
          onClick={() => onForward(30)}
          className={cx(
            "rounded-full bg-transparent p-2 text-gray-700",
            "transition-all duration-200 ease-in-out",
            "hover:text-gray-900",
            "focus:bg-gray-200 focus:outline-none"
          )}
        >
          <IconSkipThirty className="h-12 w-12 fill-current" />
        </motion.button>
      </div>
    </div>
  );
}
