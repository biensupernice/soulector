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
                className="h-full w-full bg-gray-200"
                src={track.picture_large}
                alt={track.name}
              />
              {playing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-indigo-600 opacity-75" />
                  <div className="relative rounded-full bg-white p-1 leading-none text-indigo-600 hover:shadow-sm">
                    <IconSpeaker className="relative block h-6 w-6 fill-current" />
                    {/* <PauseIcon className="fill-current w-6 h-6" /> */}
                  </div>
                </div>
              )}
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
                className={cx("font-bold leading-tight", "md:text-lg", {
                  "text-indigo-600": playing,
                })}
              >
                {track.name}
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
