import React, { useState } from "react";
import cx from "classnames";
import { formatDate, formatTimeSecs } from "../helpers";
import {
  BarsArrowDown,
  BarsArrowUp,
  HeartFilled,
  HeartOutline,
  IconDotsHorizontal,
  IconSpeaker,
} from "./Icons";
import { usePlayEpisodeMutation } from "../EpisodesScreen/useEpisodesScreenState";
import { usePlayerPlaying } from "../EpisodesScreen/PlayerStore";
import { EpisodeProjection } from "@/server/router";
import {
  EpisodeTracksList,
  useEpisodeTracks,
} from "../EpisodesScreen/EpisodeModalSheet";
import { AnimatePresence, motion } from "framer-motion";

export type EpisodeProps = {
  episode: EpisodeProjection;
  selected?: boolean;
  favorite?: boolean;
  onFavoriteClick?: () => void;
  onOptionsClick?: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

export function Episode(props: EpisodeProps) {
  const [showTracks, setShowTracks] = useState<boolean>(false);

  const {
    episode: episode,
    selected: selected = false,
    onClick,
    favorite = false,
    onFavoriteClick = () => {},
    onOptionsClick = () => {},
  } = props;

  const { hasTracks, loaded: hasTracksLoaded } = useEpisodeTracks(
    episode.id,
    selected,
  );

  return (
    <>
      <div
        data-episode-id={episode.id}
        className="flex h-full w-full items-stretch"
      >
        <div
          onClick={onClick}
          className={cx(
            "flex w-full cursor-pointer items-center justify-between border border-transparent p-3 text-left md:rounded-lg",
            "active:bg-slate-50 md:hover:border md:hover:border-gray-100 md:hover:bg-slate-50",
            "group transition-colors duration-75 focus:outline-none",
          )}
        >
          <div className="flex items-center justify-start text-left">
            <div className="flex w-full items-center">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                <img
                  loading={"lazy"}
                  className="h-full w-full bg-gray-200"
                  src={episode.artworkUrl}
                  alt={episode.name}
                />
                {selected && <AlbumArtOverlay />}
              </div>
              <div className="ml-2 md:flex md:flex-col-reverse">
                <div className="text-sm text-gray-700 md:text-base">
                  <span>{formatDate(episode.releasedAt)}</span>
                  <span className="mx-1 inline-block md:hidden">&bull;</span>
                  <span className="inline-block md:hidden">
                    {formatTimeSecs(episode.duration)}
                  </span>
                </div>
                <div
                  className={cx(
                    "flex items-start space-x-[4px]",
                    "md:text-lg",
                    {
                      "text-accent": selected,
                    },
                  )}
                >
                  {selected && (
                    <div className="shrink-0">
                      <PlayingAnimation />
                    </div>
                  )}
                  <div className="font-bold leading-tight">{episode.name}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden items-center justify-end space-x-8 md:flex">
            <div className="w-full flex space-x-3">
              {hasTracks && selected && (
                <button
                  className={cx(
                    "inline-block rounded-full p-2",
                    "transition-all duration-200 ease-in-out opacity-0",
                    "focus:outline-none hover:bg-gray-200 group-hover:opacity-100",
                    showTracks && "!opacity-100",
                  )}
                  title={showTracks ? "Close tracks" : "View Tracks"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTracks((currentState) => !currentState);
                  }}
                >
                  {showTracks ? (
                    <BarsArrowUp className="h-5 w-5 fill-current" />
                  ) : (
                    <BarsArrowDown className="h-5 w-5 stroke-current" />
                  )}
                </button>
              )}

              <button
                className={cx(
                  "inline-block rounded-full p-2",
                  "transition-all duration-200 ease-in-out",
                  "hover:bg-gray-200",
                  "focus:outline-none",
                  "opacity-0 group-hover:opacity-100",
                  favorite && "text-accent opacity-100",
                )}
                title={favorite ? "Remove from favorites" : "Add to favorites"}
                onClick={(e) => {
                  e.stopPropagation();
                  onFavoriteClick();
                }}
              >
                {favorite ? (
                  <HeartFilled className="h-5 w-5 fill-current" />
                ) : (
                  <HeartOutline className="h-5 w-5 stroke-current" />
                )}
              </button>
            </div>

            <span className="ml-">{formatTimeSecs(episode.duration)}</span>
          </div>
        </div>
        <div className="flex md:hidden">
          <button
            className={cx(
              "flex h-full w-full items-center pl-2 pr-3",
              "active:bg-slate-50",
              "focus:outline-none",
            )}
            onClick={() => onOptionsClick()}
          >
            <IconDotsHorizontal className="h-5 w-5 stroke-current " />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {selected && showTracks && (
          <motion.div
            transition={{ type: "spring", mass: 0.15, duration: 0.02 }}
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="hidden md:flex max-h-[calc(100vh*0.6)] items-stretch origin-top bg-accent rounded-lg overflow-y-auto relative"
          >
            <EpisodeTracksList episodeId={episode.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function PlayingAnimation() {
  const isPlaying = usePlayerPlaying();

  return (
    <div className="grid h-[16px] w-[11px] grid-cols-3 items-end gap-px pt-1 md:h-[17px] md:w-[14px] md:grid-cols-5 md:pt-0">
      {isPlaying ? (
        <>
          <div className="current-track-animation h-5/6 origin-bottom bg-accent transition-colors"></div>
          <div className="current-track-animation h-full origin-bottom bg-accent transition-colors [animation-delay:-70ms] [animation-duration:420ms_!important]"></div>
          <div className="current-track-animation-1 h-full origin-bottom bg-accent transition-colors [animation-delay:-200ms] [animation-duration:580ms_!important]"></div>
          <div className="current-track-animation hidden h-4/5 origin-bottom bg-accent transition-colors [animation-delay:100ms] md:block"></div>
          <div className="current-track-animation-1 hidden h-3/4 origin-bottom bg-accent transition-colors [animation-delay:-70ms] [animation-duration:420ms_!important] md:block"></div>
        </>
      ) : (
        <>
          <div className="h-1/6 origin-bottom bg-accent transition-colors"></div>
          <div className="h-1/6 origin-bottom bg-accent transition-colors [animation-delay:-70ms] [animation-duration:420ms_!important]"></div>
          <div className="h-1/6 origin-bottom bg-accent transition-colors [animation-delay:-200ms] [animation-duration:580ms_!important]"></div>
          <div className="hidden h-1/6 origin-bottom bg-accent transition-colors [animation-delay:100ms] md:block"></div>
          <div className="hidden h-1/6 origin-bottom bg-accent transition-colors [animation-delay:-70ms] [animation-duration:420ms_!important] md:block"></div>
        </>
      )}
    </div>
  );
}

function AlbumArtOverlay() {
  const { isLoading } = usePlayEpisodeMutation();

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-accent opacity-75" />
      <div className="relative rounded-full bg-white p-1 leading-none text-accent hover:shadow-sm">
        {isLoading ? (
          <svg
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 animate-ping p-1"
          >
            <circle cx="10" cy="10" r="9" fill="currentColor" />
          </svg>
        ) : (
          <IconSpeaker className="relative block h-6 w-6 fill-current" />
        )}
        {/* <PauseIcon className="fill-current w-6 h-6" /> */}
      </div>
    </div>
  );
}
