import React from "react";
import Player from "./Player";
import { ShuffleButton } from "../components/ShuffleButton";
import EpisodeListSpinner from "./EpisodeList/EpisodeListSpinner";
import { EpisodeList } from "./EpisodeList";
import { useTracksScreenContainer } from "./TracksScreenContainer";
import { EpisodeListError } from "./EpisodeList/EpisodeListError";
import { useFavorites } from "./FavoritesStore";
import classNames from "classnames";
import { useEpisodes, useFilterEpisodes } from "./TracksStore";

type Props = {
  searchText: string;
};

function TracksScreen({ searchText }: Props) {
  const [activeSection, setActiveSection] = React.useState<"all" | "favorites">(
    "all"
  );

  const { data: episodes, error } = useEpisodes();

  const { currentTrackId, onTrackClick, onRandomClick } =
    useTracksScreenContainer();

  const { isFavorite } = useFavorites();

  const filteredTracks = useFilterEpisodes(
    React.useCallback(
      (episodes) => {
        if (activeSection === "favorites") {
          return episodes.filter((episode) => isFavorite(episode._id));
        }

        if (!searchText) {
          return episodes;
        }

        return episodes.filter((episode) => {
          return episode.name
            .toLocaleLowerCase()
            .includes(searchText.toLocaleLowerCase());
        });
      },
      [activeSection, searchText, isFavorite]
    )
  );

  const shouldShowSuffleButton = !searchText && episodes;

  if (episodes) {
    return (
      <div className="flex-col flex-2 mt-14 h-full overflow-hidden pt-safe-top md-safe-bottom relative">
        <div
          className={classNames(
            "h-full py-2 overflow-scroll relative pb-safe-bottom",
            currentTrackId && "mb-24"
          )}
        >
          <EpisodeList
            activeSection={activeSection}
            onSectionClick={(section) => setActiveSection(section)}
            filterText={searchText}
            episodes={filteredTracks}
            currentEpisodeId={currentTrackId}
            onEpisodeClick={onTrackClick}
            onRandomClick={onRandomClick}
            focusedEpisodeId={currentTrackId}
          />
        </div>
        <div className="fixed w-full right-0 bottom-0 pb-safe-bottom z-20 bg-white">
          {shouldShowSuffleButton && (
            <div className="absolute bottom-full w-full flex justify-end pr-4 mb-2 md:mb-4">
              <ShuffleButton onClick={onRandomClick} />
            </div>
          )}
          {currentTrackId && (
            <div className="w-full bg-white md-safe-bottom">
              <Player />
            </div>
          )}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full overflow-hidden pt-safe-top mt-14 mb-safe-bottom">
        <EpisodeListError />
        <code>{error.message}</code>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden pt-safe-top mb-safe-bottom">
      <EpisodeListSpinner />
    </div>
  );
}

export default TracksScreen;
