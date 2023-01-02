import React from "react";
import cx from "classnames";
import { formatDate, formatTimeSecs } from "../helpers";
import {
  HeartFilled,
  HeartOutline,
  IconDotsHorizontal,
  IconSpeaker,
} from "./Icons";
import { ITrack } from "../TracksScreen/TracksStore";
import { usePlayEpisodeMutation } from "../TracksScreen/TracksScreenContainer";

export type TrackProps = {
  track: ITrack;
  playing?: boolean;
  favorite?: boolean;
  onFavoriteClick?: () => void;
  onOptionsClick?: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

export function Track(props: TrackProps) {
  const {
    track,
    playing = false,
    onClick,
    favorite = false,
    onFavoriteClick = () => {},
    onOptionsClick = () => {},
  } = props;

  return (
    <div
      data-episode-id={track._id}
      className="flex h-full w-full items-stretch"
    >
      <div
        onClick={onClick}
        className={cx(
          "flex w-full cursor-pointer items-center justify-between border border-transparent p-3 text-left md:rounded-lg",
          "active:bg-slate-50 md:hover:border md:hover:border-gray-100 md:hover:bg-slate-50",
          "group transition-colors duration-75 focus:outline-none"
        )}
      >
        <div className="flex items-center justify-start text-left">
          <div className="flex w-full items-center">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
              <img
                loading={"lazy"}
                className="h-full w-full bg-gray-200"
                src={track.picture_large}
                alt={track.name}
              />
              {playing && <AlbumArtOverlay />}
            </div>
            <div className="ml-2 md:flex md:flex-col-reverse">
              <div className="text-sm text-gray-700 md:text-base">
                <span>{formatDate(track.created_time)}</span>
                <span className="mx-1 inline-block md:hidden">&bull;</span>
                <span className="inline-block md:hidden">
                  {formatTimeSecs(track.duration)}
                </span>
              </div>
              <div
                className={cx("flex items-start space-x-[4px]", "md:text-lg", {
                  "text-indigo-600": playing,
                })}
              >
                {playing && <PlayingAnimation />}
                <span className="font-bold leading-tight">{track.name}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden w-28 items-center justify-between space-x-4 md:flex">
          <button
            className={cx(
              "inline-block rounded-full p-1",
              "transition-all duration-200 ease-in-out",
              "hover:bg-gray-200",
              "focus:outline-none",
              "opacity-0 group-hover:opacity-100",
              favorite && "text-indigo-600 opacity-100"
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

          <span className="">{formatTimeSecs(track.duration)}</span>
        </div>
      </div>
      <div className="flex md:hidden">
        <button
          className={cx(
            "flex h-full w-full items-center pl-2 pr-3",
            "active:bg-slate-50",
            "focus:outline-none"
          )}
          onClick={() => onOptionsClick()}
        >
          <IconDotsHorizontal className="h-5 w-5 stroke-current " />
        </button>
      </div>
    </div>
  );
}

function PlayingAnimation() {
  return (
    <div className="grid h-[16px] md:h-[17px] w-[11px] md:w-[14px] grid-cols-3 md:grid-cols-5 items-end gap-px pt-1 md:pt-0">
      <div className="current-track-animation h-5/6 origin-bottom bg-indigo-600"></div>
      <div className="current-track-animation h-full origin-bottom bg-indigo-600 [animation-delay:-70ms] [animation-duration:420ms_!important]"></div>
      <div className="current-track-animation-1 h-full origin-bottom bg-indigo-600 [animation-delay:-200ms] [animation-duration:580ms_!important]"></div>
      <div className="hidden md:block current-track-animation h-4/5 origin-bottom bg-indigo-600 [animation-delay:100ms]"></div>
      <div className="hidden md:block current-track-animation-1 h-3/4 origin-bottom bg-indigo-600 [animation-delay:-70ms] [animation-duration:420ms_!important]"></div>
    </div>
  );
}

function AlbumArtOverlay() {
  const { isLoading } = usePlayEpisodeMutation();

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-indigo-600 opacity-75" />
      <div className="relative rounded-full bg-white p-1 leading-none text-indigo-600 hover:shadow-sm">
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
