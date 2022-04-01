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
} & React.HTMLAttributes<HTMLDivElement>;

export function Track(props: TrackProps) {
  const {
    track,
    playing = false,
    onClick,
    favorite = false,
    onFavoriteClick = () => {},
  } = props;

  return (
    <div className="flex items-stretch h-full">
      <div
        onClick={onClick}
        className={cx(
          "flex items-center justify-between text-left cursor-pointer w-full p-3 md:rounded-lg border border-transparent",
          "active:bg-slate-50 md:hover:bg-slate-50 md:hover:border md:hover:border-gray-100",
          "group focus:outline-none transition-colors duration-75"
        )}
      >
        <div className="flex items-center justify-start text-left">
          <div className="flex items-center w-full">
            <div className="flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden relative">
              <img
                className="w-full h-full bg-gray-200"
                src={track.picture_large}
                alt={track.name}
              />
              {playing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-indigo-600 opacity-75" />
                  <div className="relative leading-none p-1 bg-white rounded-full text-indigo-600 hover:shadow-sm">
                    <IconSpeaker className="relative block fill-current w-6 h-6" />
                    {/* <PauseIcon className="fill-current w-6 h-6" /> */}
                  </div>
                </div>
              )}
            </div>
            <div className="ml-2 md:flex md:flex-col-reverse">
              <div className="text-sm md:text-base text-gray-700">
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
        <div className="hidden md:flex items-center space-x-4 w-28 justify-between">
          <button
            className={cx(
              "inline-block p-1 rounded-full",
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
              <HeartFilled className="fill-current w-5 h-5" />
            ) : (
              <HeartOutline className="stroke-current w-5 h-5" />
            )}
          </button>

          <span className="">{formatTimeSecs(track.duration)}</span>
        </div>
      </div>
      <div className="flex md:hidden">
        <button
          className={cx(
            "h-full w-full pl-2 pr-3 flex items-center",
            "active:bg-slate-50",
            "focus:outline-none"
          )}
          onClick={() => {
            alert(`Clicked ${track.name}`);
          }}
        >
          <IconDotsHorizontal className="stroke-current h-5 w-5 " />
        </button>
      </div>
    </div>
  );
}
