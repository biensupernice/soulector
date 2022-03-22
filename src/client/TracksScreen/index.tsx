import React from "react";
import Navbar from "./Navbar";
import Player from "./Player";
import { ShuffleButton } from "../components/ShuffleButton";
import { match } from "../infra/match";
import EpisodeListSpinner from "./EpisodeList/EpisodeListSpinner";
import { EpisodeList } from "./EpisodeList";
import { useTracksScreenContainer } from "./TracksScreenContainer";
import { EpisodeListError } from "./EpisodeList/EpisodeListError";
import { useFavorites } from "./FavoritesStore";
import classNames from "classnames";

type Props = {
  searchText: string;
  onSearchClose: () => void;
  onSearchChange: (searchText: string) => void;
};

function TracksScreen({ searchText, onSearchChange, onSearchClose }: Props) {
  const [activeSection, setActiveSection] = React.useState<"all" | "favorites">(
    "all"
  );
  const { activate, tracks, currentTrackId, onTrackClick, onRandomClick } =
    useTracksScreenContainer();

  const { isFavorite } = useFavorites();

  const filteredTracks = React.useMemo(() => {
    if (activeSection === "favorites") {
      return tracks.filter((track) => isFavorite(track.id));
    }

    if (!searchText) {
      return tracks;
    }

    return tracks.filter((track) => {
      return track.name
        .toLocaleLowerCase()
        .includes(searchText.toLocaleLowerCase());
    });
  }, [searchText, tracks, activeSection]);

  const shouldShowSuffleButton = !searchText && activate === "resolved";

  return (
    <div className="text-gray-900 h-full w-full">
      <div className="pt-safe-top h-15 fixed top-0 w-full bg-white shadow-md z-10">
        <Navbar
          searchText={searchText}
          onSearchChange={onSearchChange}
          onSearchClose={onSearchClose}
        />
      </div>
      {match(activate, {
        pending: () => (
          <div className="h-screen overflow-hidden pt-safe-top mb-safe-bottom">
            <EpisodeListSpinner />
          </div>
        ),
        rejected: () => (
          <div className="h-full overflow-hidden pt-safe-top mt-14 mb-safe-bottom">
            <EpisodeListError />
          </div>
        ),
        resolved: () => (
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
            {shouldShowSuffleButton && (
              <div className="fixed w-full right-0 bottom-0 pb-safe-bottom z-20 bg-white">
                <div className="absolute bottom-full w-full flex justify-end pr-4 mb-2 md:mb-4">
                  <ShuffleButton onClick={onRandomClick} />
                </div>
                {currentTrackId && (
                  <div className="w-full bg-white md-safe-bottom">
                    <Player />
                  </div>
                )}
              </div>
            )}
          </div>
        ),
      })}
    </div>
  );
}

export default TracksScreen;
