import React from "react";
import Navbar from "./Navbar";
import Player from "./Player";
import { ShuffleButton } from "../components/ShuffleButton";
import { match } from "../infra/match";
import EpisodeListSpinner from "./EpisodeList/EpisodeListSpinner";
import { EpisodeList } from "./EpisodeList";
import { useTracksScreenContainer } from "./TracksScreenContainer";
import { EpisodeListError } from "./EpisodeList/EpisodeListError";

type Props = {
  searchText: string;
  onSearchClose: () => void;
  onSearchChange: (searchText: string) => void;
};

function TracksScreen({ searchText, onSearchChange, onSearchClose }: Props) {
  const { activate, tracks, currentTrackId, onTrackClick, onRandomClick } =
    useTracksScreenContainer();

  const filteredTracks = React.useMemo(() => {
    if (!searchText) {
      return tracks;
    }

    return tracks.filter((track) =>
      track.name.toLocaleLowerCase().includes(searchText.toLocaleLowerCase())
    );
  }, [searchText, tracks]);

  const shouldShowSuffleButton = !searchText && activate === "resolved";

  return (
    <div className="flex flex-col text-gray-900 fixed h-full w-full">
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
