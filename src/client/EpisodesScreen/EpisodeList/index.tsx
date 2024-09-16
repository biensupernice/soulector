import React, { useRef, useImperativeHandle } from "react";

type EpisodeListProps = {
  children: React.ReactElement;
};

export type EpisodeListHandle = {
  focusEpisode: (episodeId: string) => void;
};

export const EpisodeList = React.forwardRef<
  EpisodeListHandle,
  EpisodeListProps
>(({ children }: EpisodeListProps, ref) => {
  const episodeListRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(
    ref,
    () => {
      return {
        focusEpisode(episodeId: string) {
          const episode = episodeListRef.current?.querySelector(
            `[data-episode-id="${episodeId}"]`,
          );
          if (episode) {
            episode.scrollIntoView({
              block: "center",
            });
          }
        },
      };
    },
    [],
  );

  return (
    <div
      ref={episodeListRef}
      className="m-auto mb-16 flex w-full max-w-4xl flex-col"
    >
      {children}
    </div>
  );
});
