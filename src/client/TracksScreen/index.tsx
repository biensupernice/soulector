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
import { AnimatePresence } from "framer-motion";
import { EpisodeListHeader } from "./EpisodeListHeader";

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
      (eps) => {
        if (activeSection === "favorites") {
          return eps.filter((episode) => isFavorite(episode._id));
        }

        if (!searchText) {
          return eps;
        }

        return eps.filter((episode) => {
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
      <div className="flex-2 md-safe-bottom relative mt-14 h-full flex-col overflow-hidden pt-safe-top">
        <div
          className={classNames(
            "relative h-full overflow-scroll py-2 pb-safe-bottom",
            currentTrackId && "mb-24"
          )}
        >
          <EpisodeList
            episodes={filteredTracks}
            currentEpisodeId={currentTrackId}
            onEpisodeClick={onTrackClick}
            onRandomClick={onRandomClick}
            focusedEpisodeId={currentTrackId}
            beforeList={
              <EpisodeListHeader
                filterText={searchText}
                numEpisodes={filteredTracks.length}
                activeSection={activeSection}
                onSectionClick={(section) => setActiveSection(section)}
              />
            }
          />
        </div>
        <div className="fixed right-0 bottom-0 z-20 w-full bg-white pb-safe-bottom">
          {shouldShowSuffleButton && (
            <div className="absolute bottom-full mb-2 flex w-full justify-end pr-4 md:mb-4">
              <ShuffleButton onClick={onRandomClick} />
            </div>
          )}
          {currentTrackId && (
            <div className="md-safe-bottom w-full bg-white">
              <Player />
            </div>
          )}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-14 mb-safe-bottom h-full overflow-hidden pt-safe-top">
        <EpisodeListError />
        <code>{error.message}</code>
      </div>
    );
  }

  return (
    <div className="mb-safe-bottom h-screen overflow-hidden pt-safe-top">
      <EpisodeListSpinner />
    </div>
  );
}

export default TracksScreen;
