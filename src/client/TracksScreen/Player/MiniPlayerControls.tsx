import React from "react";
import { formatDate } from "../../helpers";
import { IconPause, IconPlay, IconSkipThirty } from "../../components/Icons";
import cx from "classnames";
import { motion } from "framer-motion";
import { PlayerControlsProps } from "./PlayerControls";

export interface MiniPlayerControlsPromps extends PlayerControlsProps {
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
    <div className="relative grid h-full grid-cols-10">
      <div className="absolute top-0 h-[2px] w-full bg-gray-300">
        <div
          className="absolute top-0 h-[2px] bg-accent"
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
              "rounded-fullp-1 rounded-full leading-none text-accent",
              "transition-all duration-200 ease-in-out",
              "hover:text-accent",
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
