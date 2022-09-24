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
import { Slider as ReachSlider } from "@reach/slider";
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

  const newProgress = seeking ? seekPosition : playerProgress;

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
          className={cx("gap-5 grid grid-cols-3 xl:grid-cols-10", {
            hidden: useEmbed,
          })}
        >
          <div className="xl:col-span-2 flex items-center space-x-3 ">
            <div className="flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden relative">
              <img
                className="w-full h-full bg-gray-200"
                src={track.picture_large}
                alt={track.name}
              />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-md font-bold leading-tight">
                {track.name}
              </div>
              <div className="text-gray-700 text-md">
                {formatDate(track.created_time)}
              </div>
            </div>
          </div>
          {/* Player */}
          <div className="flex flex-col items-center justify-center xl:col-span-6 space-y-1">
            <div className="flex items-center justify-center space-x-4">
              <button
                title="Rewind 30 seconds"
                onClick={() => onRewind(30)}
                className={cx(
                  "bg-transparent rounded-full text-gray-700 p-2",
                  "transition-all duration-200 ease-in-out",
                  "hover:text-gray-900",
                  "focus:outline-none focus:bg-gray-200"
                )}
              >
                <IconBackThirty className="fill-current h-8 w-8" />
              </button>
              <button
                onClick={() => (playing ? onPause() : onResume())}
                className={cx(
                  "p-2 rounded-full bg-indigo-600 border shadow-md text-white leading-none",
                  "transition-all duration-200 ease-in-out",
                  "hover:bg-indigo-700 hover:shadow-lg",
                  "focus:outline-none focus:bg-indigo-700"
                )}
              >
                {playing ? (
                  <IconPause className="fill-current w-8 h-8 inline-block" />
                ) : (
                  <IconPlay className="fill-current w-8 h-8 inline-block" />
                )}
              </button>
              <button
                title="Forward 30 seconds"
                onClick={() => onForward(30)}
                className={cx(
                  "bg-transparent rounded-full text-gray-700 p-2",
                  "transition-all duration-200 ease-in-out",
                  "hover:text-gray-900",
                  "focus:outline-none focus:bg-gray-200"
                )}
              >
                <IconSkipThirty className="fill-current h-8 w-8" />
              </button>
            </div>
            <div className="max-w-3xl w-full">
              <>
                <div className="flex justify-center items-center">
                  <div className="text-xs w-10 text-right">
                    {formatTime(Math.ceil(playerProgress))} <br />
                    {formatTime(Math.ceil(newProgress))}
                  </div>
                  <div className="flex flex-1 flex-col justify-center max-w-xl mx-3 relative w-full">
                    <ReachSlider
                      max={trackDuration}
                      value={playerProgress}
                      onMouseDown={() => setSeeking(true)}
                      onChange={(newVal) => {
                        setPlayerProgress(newVal);
                        lastSeekPos.current = newVal;
                      }}
                      onMouseUp={() => {
                        setSeeking(false);
                        onCuePositionChange(lastSeekPos.current);
                      }}
                    />
                    <Slider
                      minValue={0}
                      maxValue={trackDuration}
                      value={newProgress}
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
                  <div className="text-xs w-10">
                    {formatTime(Math.ceil(trackDuration))}
                  </div>
                </div>
              </>
            </div>
          </div>
          {/* Volume */}
          <div className="xl:col-span-2 flex items-center space-x-2 justify-end">
            <div className="flex space-x-1 items-center">
              <a
                className={cx(
                  "inline-block p-2 rounded-full",
                  "transition-all duration-200 ease-in-out",
                  "hover:bg-gray-200 "
                )}
                title="Open in SoundCloud"
                target="_blank"
                rel="noopener noreferrer"
                href={track.url}
              >
                <IconSoundcloud className="fill-current w-5 h-5" />
              </a>
              <div className="flex space-x-1 items-center">
                <button
                  className={cx(
                    "inline-block p-1 rounded-full",
                    "transition-all duration-200 ease-in-out",
                    "hover:bg-gray-200",
                    "focus:outline-none"
                  )}
                  title={muted ? "Unmute" : "Mute"}
                  onClick={() => {
                    muted ? onUnmute() : onMute();
                  }}
                >
                  <IconSpeaker className="fill-current w-5 h-5" />
                </button>
                <div className="w-40 pr-4">
                  <ReachSlider
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(val) => onVolumeChange(val)}
                  />
                  <Slider
                    minValue={0}
                    maxValue={100}
                    value={volume}
                    label="test"
                    onChange={(val) => {
                      const nval = Array.isArray(val) ? val[0] : val;
                      onVolumeChange(nval);
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
