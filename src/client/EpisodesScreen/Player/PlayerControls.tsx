import React, { useContext, useState } from "react";
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
import { Slider } from "@/client/components/Slider";
import { motion } from "framer-motion";
import { EpisodeProjection } from "@/server/router";
import { EpisodeListContext } from "@/pages";

export type PlayerControlsProps = {
  episode: EpisodeProjection;
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
  episodeDuration: number;
  loading: boolean;
};
export function PlayerControls({
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

  const scrubberProgress = seeking ? seekPosition : progress;

  const { focusEpisode } = useContext(EpisodeListContext);

  return (
    <div className={cx("grid grid-cols-3 gap-5 xl:grid-cols-10")}>
      <div className="flex items-center space-x-3 xl:col-span-2 ">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
          <img
            className="h-full w-full bg-gray-200"
            src={episode.artworkUrl}
            alt={episode.name}
          />
        </div>
        <div className="flex flex-col justify-center">
          <button
            className="text-md text-left hover:underline font-bold leading-tight"
            onClick={() => focusEpisode(episode.id)}
          >
            {episode.name}
          </button>
          <div className="text-md text-gray-700">
            {formatDate(episode.releasedAt)}
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
              "focus:bg-gray-200 focus:outline-none",
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
              "rounded-full border bg-accent p-2 leading-none text-white shadow-md",
              "transition-all duration-200 ease-in-out",
              "hover:bg-accent/90 hover:shadow-lg",
              "focus:bg-accent/90 focus:outline-none",
              loading && "cursor-not-allowed disabled:cursor-not-allowed",
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
              "focus:bg-gray-200 focus:outline-none",
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
                  maxValue={episodeDuration}
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
                {formatTime(Math.ceil(episodeDuration))}
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
              "hover:bg-gray-200 ",
            )}
            title="Open in SoundCloud"
            target="_blank"
            rel="noopener noreferrer"
            href={episode.permalinkUrl}
          >
            <IconSoundcloud className="h-5 w-5 fill-current" />
          </a>
          <div className="flex items-center space-x-1">
            <button
              className={cx(
                "inline-block rounded-full p-1",
                "transition-all duration-200 ease-in-out",
                "hover:bg-gray-200",
                "focus:outline-none",
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
