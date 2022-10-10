import React, { useRef, useEffect } from "react";
import { Track } from "../../components/Track";
import { useFavorites } from "../FavoritesStore";
import { ITrack } from "../TracksStore";
import { useTrackOptionsStore } from "@/client/TracksScreen/TrackOptionsModal";
import { AnimatePresence, motion } from "framer-motion";

type EpisodeListProps = {
  episodes: ITrack[];
  currentEpisodeId?: string;
  beforeList?: React.ReactElement;
  onEpisodeClick: (trackId: string) => void;
  onRandomClick: () => void;
  focusedEpisodeId?: string;
};

export function EpisodeList({
  episodes,
  onEpisodeClick,
  currentEpisodeId,
  focusedEpisodeId,
  beforeList,
}: EpisodeListProps) {
  const episodeListRef = useRef<HTMLDivElement | null>(null);
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
        episodeListRef.current?.scrollTo({
          top: 0,
        });
      }
    }
  }, [focusedEpisodeId, episodes]);

  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  return (
    <div
      ref={episodeListRef}
      className="m-auto mb-16 flex w-full max-w-4xl flex-col"
    >
      {beforeList ? beforeList : null}
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
