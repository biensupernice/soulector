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
    <div className="flex flex-col text-gray-900 fixed h-full w-full pt-safe-top">
      <div className="flex-1 h-full">
        <Navbar
          searchText={searchText}
          onSearchChange={onSearchChange}
          onSearchClose={onSearchClose}
        />
      </div>
      <div className="flex-col flex-2 h-full overflow-hidden relative">
        <div className="h-full overflow-scroll">
          {match(activate, {
            pending: () => <EpisodeListSpinner />,
            rejected: () => <EpisodeListError />,
            resolved: () => (
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
            ),
          })}
        </div>
        {shouldShowSuffleButton && (
          <div className="absolute border-blue-500 right-0 bottom-0 mb-2 mr-2 md:mb-5 md:mr-5 z-10">
            <ShuffleButton onClick={onRandomClick} />
          </div>
        )}
      </div>
      {currentTrackId && (
        <div className="w-full">
          <Player />
        </div>
      )}
    </div>
  );
}

export default TracksScreen;
