import React, { useRef, useEffect } from "react";
import { Track } from "../../components/Track";
import { useFavorites } from "../FavoritesStore";
import cx from "classnames";
import { ITrack } from "../TracksStore";
import { useTrackOptionsStore } from "@/pages/TrackOptionsModal";

type EpisodeListProps = {
  episodes: ITrack[];
  currentEpisodeId?: string;
  onEpisodeClick: (trackId: string) => void;
  onRandomClick: () => void;
  focusedEpisodeId?: string;
  filterText?: string;
  activeSection?: "favorites" | "all";
  onSectionClick?: (section: "favorites" | "all") => void;
};

export function EpisodeList({
  episodes,
  onEpisodeClick,
  currentEpisodeId,
  focusedEpisodeId,
  filterText,
  activeSection = "all",
  onSectionClick = () => {},
}: EpisodeListProps) {
  const episodeListRef = useRef<HTMLDivElement | null>(null);
  const beforeListRef = useRef<HTMLDivElement | null>(null);
  const setContextMenuTrack = useTrackOptionsStore((state) => state.setTrack);

  useEffect(() => {
    if (focusedEpisodeId) {
      const episode = episodeListRef.current?.querySelector(
        `[data-episode-id="${focusedEpisodeId}"]`
      );
      if (episode) {
        episode.scrollIntoView({
          block: "center",
        });
      } else {
        if (beforeListRef.current) {
          beforeListRef.current.scrollIntoView({
            block: "center",
          });
        }
      }
    }
  }, [focusedEpisodeId, episodes]);

  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  return (
    <div
      ref={episodeListRef}
      className="flex max-w-4xl m-auto flex-col mb-16 w-full"
    >
      <div ref={beforeListRef}>
        <BeforeList
          filterText={filterText}
          numEpisodes={episodes.length}
          activeSection={activeSection}
          onSectionClick={onSectionClick}
        />
      </div>
      {episodes.map((episode) => (
        <div key={episode._id} data-episode-id={episode._id} className="w-full">
          <Track
            onClick={() => onEpisodeClick(episode._id)}
            track={episode}
            playing={episode._id === currentEpisodeId}
            favorite={isFavorite(episode._id)}
            onOptionsClick={() => {
              setContextMenuTrack(episode);
            }}
            onFavoriteClick={() => {
              if (isFavorite(episode._id)) {
                removeFavorite(episode._id);
              } else {
                addFavorite(episode._id);
              }
            }}
          />
        </div>
      ))}
    </div>
  );
}

type BeforeListProps = {
  numEpisodes: number;
  filterText?: string;
  activeSection?: "all" | "favorites";
  onSectionClick?: (section: "all" | "favorites") => void;
};
function BeforeList({
  numEpisodes,
  filterText,
  activeSection = "all",
  onSectionClick = () => {},
}: BeforeListProps) {
  return (
    <div className="px-4 flex item-center mt-4 mb-2">
      <div className="font-semibold mr-auto">
        <div className="space-x-4 -mx-3">
          <button
            className={cx(
              "inline-flex px-3 py-1 rounded hover:bg-gray-100",
              activeSection === "all" && "text-indigo-800 font-bold",
              "text-gray-900"
            )}
            onClick={() => onSectionClick("all")}
          >
            {filterText ? `Episodes matching "${filterText}"` : "All Episodes"}
          </button>
          <button
            className={cx(
              "hidden md:inline-flex",
              "inline-flex px-3 py-1 rounded hover:bg-gray-100",
              activeSection === "favorites" && "text-indigo-800 font-bold",
              "text-gray-900"
            )}
            onClick={() => onSectionClick("favorites")}
          >
            Favorites
          </button>
        </div>
      </div>
      <div className="font-semibold text-gray-600">{numEpisodes} Total</div>
    </div>
  );
}
