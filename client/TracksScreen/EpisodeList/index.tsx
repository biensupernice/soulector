import React, { useRef, useEffect } from "react";
import { Track } from "../../components/Track";
import { TrackModel } from "../TracksStore";

type EpisodeListProps = {
  episodes: TrackModel[];
  currentEpisodeId?: string;
  onEpisodeClick: (trackId: string) => void;
  onRandomClick: () => void;
  focusedEpisodeId?: string;
  filterText?: string;
};

export function EpisodeList({
  episodes,
  onEpisodeClick,
  currentEpisodeId,
  focusedEpisodeId,
  filterText,
}: EpisodeListProps) {
  const episodeListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusedEpisodeId) {
      const episode = episodeListRef.current?.querySelector(
        `[data-episode-id="${focusedEpisodeId}"]`
      );
      if (episode) {
        episode.scrollIntoView({
          block: "center",
        });
      }
    }
  }, [focusedEpisodeId, episodes]);

  return (
    <div ref={episodeListRef} className="flex h-full max-w-4xl m-auto flex-col">
      <BeforeList filterText={filterText} numEpisodes={episodes.length} />
      {episodes.map((episode) => (
        <div key={episode.id} data-episode-id={episode.id} className="w-full">
          <Track
            onClick={() => onEpisodeClick(episode.id)}
            track={episode}
            playing={episode.id === currentEpisodeId}
          />
        </div>
      ))}
    </div>
  );
}

type BeforeListProps = {
  numEpisodes: number;
  filterText?: string;
};
function BeforeList({ numEpisodes, filterText }: BeforeListProps) {
  return (
    <div className="px-4 flex item-center mt-4 mb-2">
      <div className="font-semibold mr-auto text-indigo-900">
        {filterText ? `Episodes matching "${filterText}"` : "All Episodes"}
      </div>
      <div className="font-semibold text-gray-600">{numEpisodes} Total</div>
    </div>
  );
}
