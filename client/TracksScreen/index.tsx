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

  return (
    <div className="flex flex-col h-screen text-gray-900">
      <div className="flex-1">
        <Navbar
          searchText={searchText}
          onSearchChange={onSearchChange}
          onSearchClose={onSearchClose}
        />
      </div>
      <div className="flex-2 h-full overflow-scroll relative">
        <div className="h-full overflow-scroll pb-16">
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
        {!searchText && activate != "rejected" && (
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
