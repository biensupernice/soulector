import React, { useState, useEffect, useRef } from "react";
import { formatTime } from "../../helpers";
import {
  IconPause,
  IconPlay,
  IconBackThirty,
  IconSkipThirty,
} from "../../components/Icons";
import cx from "classnames";
import { Slider } from "@/client/components/Slider";
import { motion } from "framer-motion";
import { PlayerControlsProps } from "./PlayerControls";

export function MobilePlayerControls({
  episode,
  episodeDuration,
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
  const pendingSeekRef = useRef<number | null>(null);

  // Sync seekPosition with progress, but wait for progress to catch up after seeking
  useEffect(() => {
    if (!seeking) {
      if (pendingSeekRef.current !== null) {
        // We're waiting for progress to catch up to our seek position
        const diff = Math.abs(progress - pendingSeekRef.current);
        if (diff < 500) {
          // Progress has caught up, clear the pending seek
          pendingSeekRef.current = null;
          setSeekPosition(progress);
        }
      } else {
        // Normal operation - keep seekPosition in sync with progress
        setSeekPosition(progress);
      }
    }
  }, [progress, seeking]);

  const scrubberProgress = seekPosition;

  return (
    <div className="flex h-full flex-col items-center space-y-3 pb-4">
      <div className="flex w-full max-w-3xl flex-col">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mx-3 flex w-full max-w-xl flex-1 flex-col justify-center">
            <Slider
              variant="flat"
              aria-label="progress"
              minValue={0}
              maxValue={episodeDuration}
              value={scrubberProgress}
              onChange={(val) => {
                setSeeking(true);
                setSeekPosition(val);
              }}
              onChangeEnd={(val) => {
                pendingSeekRef.current = val;
                onCuePositionChange(val);
                setSeeking(false);
              }}
            />
          </div>
          <div className="flex w-full justify-between">
            <div className="text-right text-xs text-white">
              {formatTime(Math.ceil(scrubberProgress))}
            </div>
            <div className="text-left text-xs text-white">
              {formatTime(Math.ceil(episodeDuration))}
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
            "rounded-full bg-transparent p-2 text-white",
            "transition-all duration-200 ease-in-out",
            "hover:text-white/80",
            "focus:bg-white/80 focus:outline-none"
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
            "rounded-full border bg-white p-4 leading-none text-accent shadow-md",
            "transition-all duration-200 ease-in-out",
            "hover:white/90 hover:shadow-lg",
            "focus:white/90 focus:outline-none",
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
            "rounded-full bg-transparent p-2 text-white",
            "transition-all duration-200 ease-in-out",
            "hover:text-white/80",
            "focus:bg-white/80 focus:outline-none"
          )}
        >
          <IconSkipThirty className="h-12 w-12 fill-current" />
        </motion.button>
      </div>
    </div>
  );
}
