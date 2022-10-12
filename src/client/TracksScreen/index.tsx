import React, { useMemo } from "react";
import Player from "./Player";
import { ShuffleButton } from "../components/ShuffleButton";
import EpisodeListSpinner from "./EpisodeList/EpisodeListSpinner";
import { EpisodeList } from "./EpisodeList";
import { useTracksScreenContainer } from "./TracksScreenContainer";
import { EpisodeListError } from "./EpisodeList/EpisodeListError";
import { useFavorites } from "./FavoritesStore";
import classNames from "classnames";
import { ITrack, useEpisodes, useFilterEpisodes } from "./TracksStore";
import { EpisodeListHeader } from "./EpisodeListHeader";
import { useTrackOptionsStore } from "./TrackOptionsModal";
import { Track } from "../components/Track";

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

  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const setContextMenuTrack = useTrackOptionsStore((state) => state.setTrack);

  const favorites = useMemo(() => {
    if (episodes) {
      return episodes.filter((episode) => isFavorite(episode._id));
    }

    return [];
  }, [episodes, activeSection]);

  const filteredTracks = useMemo(() => {
    if (episodes) {
      if (activeSection === "favorites") {
        return favorites;
      }

      if (!searchText) {
        return episodes;
      }

      return episodes.filter((episode) =>
        episode.name
          .toLocaleLowerCase()
          .includes(searchText.toLocaleLowerCase())
      );
    }

    return [];
  }, [episodes, favorites, activeSection, searchText, isFavorite]);

  function onFavoriteClick(episode: ITrack) {
    if (isFavorite(episode._id)) {
      removeFavorite(episode._id);
    } else {
      addFavorite(episode._id);
    }
  }

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
          <EpisodeList focusedEpisodeId={currentTrackId}>
            <>
              <EpisodeListHeader
                filterText={searchText}
                numEpisodes={filteredTracks.length}
                activeSection={activeSection}
                onSectionClick={(section) => setActiveSection(section)}
              />
              {filteredTracks.map((episode) => (
                <Track
                  key={episode._id}
                  onClick={() => onTrackClick(episode._id)}
                  track={episode}
                  playing={episode._id === currentTrackId}
                  favorite={isFavorite(episode._id)}
                  onOptionsClick={() => setContextMenuTrack(episode)}
                  onFavoriteClick={() => onFavoriteClick(episode)}
                />
              ))}
            </>
          </EpisodeList>
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
