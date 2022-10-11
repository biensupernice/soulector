import React, { useRef, useEffect } from "react";

type EpisodeListProps = {
  focusedEpisodeId?: string;
  children: React.ReactElement;
};

export function EpisodeList({ focusedEpisodeId, children }: EpisodeListProps) {
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
      } else {
        episodeListRef.current?.scrollTo({
          top: 0,
        });
      }
    }
  }, [focusedEpisodeId]);

  return (
    <div
      ref={episodeListRef}
      className="m-auto mb-16 flex w-full max-w-4xl flex-col"
    >
      {children}
    </div>
  );
}
