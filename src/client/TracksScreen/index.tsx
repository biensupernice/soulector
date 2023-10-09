import React, { useEffect, useMemo, useState, useTransition } from "react";
import Player, { USE_NEW_PLAYER } from "./Player";
import { ShuffleButton } from "../components/ShuffleButton";
import EpisodeListSpinner from "./EpisodeList/EpisodeListSpinner";
import { EpisodeList } from "./EpisodeList";
import { useTracksScreenContainer } from "./TracksScreenContainer";
import { useEpisodeAlbumArtColors } from "./useEpisodeAlbumArtColors";
import { EpisodeListError } from "./EpisodeList/EpisodeListError";
import {
  useFavorites,
  useFavoritesCount,
  useIsFavoriteFast,
} from "./FavoritesStore";
import classNames from "classnames";
import { ITrack, useEpisodes, useGetEpisode } from "./TracksStore";
import { EpisodeListHeader } from "./EpisodeListHeader";
import { useTrackOptionsStore } from "./TrackOptionsModal";
import { Track } from "../components/Track";
import { AudioPlayer } from "../components/AudioPlayer";
import {
  StreamUrls,
  usePlayerActions,
  usePlayerCuePosition,
  usePlayerLoadingStatus,
  usePlayerPlaying,
  usePlayerVolume,
} from "./PlayerStore";
import { formatDate } from "../helpers";
import { useMedia } from "../infra/useMedia";
import {
  EpisodeModalSheet,
  useEpisodeModalSheetActions,
  useEpisodeModalSheetStore,
} from "./EpisodeModalSheet";
import { IconSearch } from "../components/Icons";
import { cn } from "@/lib/utils";
import { useCollectiveSelectStore, useNavbarStore } from "./Navbar";

type Props = {
  searchText: string;
};

function TracksScreen({ searchText }: Props) {
  const [selectedSection, setSelectedSection] = useState<"all" | "favorites">(
    "all"
  );
  const [activeSection, setActiveSection] = useState<"all" | "favorites">(
    "all"
  );
  const [isPending, startTransition] = useTransition();

  const isEpisodeModalSheetOpen = useEpisodeModalSheetStore((s) => s.isOpen);
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  const { data: episodes, error } = useEpisodes();

  const {
    currentTrackId,
    onTrackClick,
    onRandomClick,
    currentTrackStreamUrls,
  } = useTracksScreenContainer();

  const { addFavorite, removeFavorite } = useFavorites();
  const setContextMenuTrack = useTrackOptionsStore((state) => state.setTrack);
  const favoritesCount = useFavoritesCount();
  const isFavoriteFast = useIsFavoriteFast();
  const selectedCollective = useCollectiveSelectStore((s) => s.selected);

  useEpisodeAlbumArtColors();

  const favorites = useMemo(() => {
    if (episodes) {
      let eps = episodes;

      if (selectedCollective !== "all") {
        eps = episodes.filter(
          (ep) => ep.collective_slug === selectedCollective
        );
      }

      return eps.filter((episode) => isFavoriteFast(episode._id));
    }

    return [];
  }, [episodes, favoritesCount, selectedCollective]);

  const searchOpen = useNavbarStore((state) => state.searchOpen);
  const openSearch = useNavbarStore((state) => state.openSearch);

  const filteredTracks = useMemo(() => {
    if (episodes) {
      let eps = episodes;

      if (selectedCollective !== "all") {
        eps = episodes.filter(
          (ep) => ep.collective_slug === selectedCollective
        );
      }

      if (!searchText.trim()) {
        return eps;
      }

      const lowerCaseSearch = searchText.toLowerCase();
      return eps.filter((episode) =>
        episode.name.toLowerCase().includes(lowerCaseSearch)
      );
    }

    return [];
  }, [episodes, searchText, selectedCollective]);

  const activeTracks = activeSection === "all" ? filteredTracks : favorites;

  function onFavoriteClick(episode: ITrack) {
    if (isFavoriteFast(episode._id)) {
      removeFavorite(episode._id);
    } else {
      addFavorite(episode._id);
    }
  }

  const isWideScreen = useMedia("(min-width: 768px)");

  const shouldShowSuffleButton = !searchText && episodes;

  function onSectionClick(section: "all" | "favorites") {
    setSelectedSection(section);
    startTransition(() => {
      setActiveSection(section);
    });
  }

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
                rightContent={
                  <div className="font-semibold text-gray-600">
                    {activeTracks.length} Total
                  </div>
                }
                filterText={searchText}
                activeSection={selectedSection}
                onSectionClick={onSectionClick}
              />
              {activeSection === "favorites" ? (
                <div>
                  {favorites.map((episode) => (
                    <Track
                      key={episode._id}
                      onClick={() => onTrackClick(episode._id)}
                      track={episode}
                      selected={episode._id === currentTrackId}
                      favorite={isFavoriteFast(episode._id)}
                      onOptionsClick={() => setContextMenuTrack(episode)}
                      onFavoriteClick={() => onFavoriteClick(episode)}
                    />
                  ))}
                </div>
              ) : (
                <div>
                  {filteredTracks.map((episode) => (
                    <Track
                      key={episode._id}
                      onClick={() => onTrackClick(episode._id)}
                      track={episode}
                      selected={episode._id === currentTrackId}
                      favorite={isFavoriteFast(episode._id)}
                      onOptionsClick={() => setContextMenuTrack(episode)}
                      onFavoriteClick={() => onFavoriteClick(episode)}
                    />
                  ))}
                </div>
              )}
            </>
          </EpisodeList>
        </div>
        <div className="fixed bottom-0 right-0 z-20 w-full bg-white pb-safe-bottom">
          {shouldShowSuffleButton || searchOpen ? (
            <div className="absolute bottom-full right-0 mb-2 flex flex-col items-end justify-end space-y-2 pr-3 md:mb-4">
              <button
                onClick={openSearch}
                className={cn(
                  "border border-accent/30 bg-white font-semibold text-accent transition-all hover:bg-gray-50 ",
                  "items-center space-x-1 px-4 py-3",
                  "rounded-full",
                  "shadow-md",
                  "hidden focus:outline-none",
                  !searchOpen && "flex sm:hidden"
                )}
              >
                <IconSearch className="h-5 w-5 fill-current" />
                <div>Search</div>
              </button>
              <ShuffleButton onClick={onRandomClick} />
            </div>
          ) : null}
          {currentTrackId && <Player currentTrackId={currentTrackId} />}
          {USE_NEW_PLAYER && currentTrackId && currentTrackStreamUrls && (
            <EpisodeAudioPlayer
              currentTrackId={currentTrackId}
              currentTrackStreamUrls={currentTrackStreamUrls}
            />
          )}
        </div>
        {!isWideScreen && (
          <EpisodeModalSheet
            episodeId={currentTrackId}
            showTrackModal={isEpisodeModalSheetOpen}
            onCloseModal={() => episodeModalSheetActions.close()}
          ></EpisodeModalSheet>
        )}
      </div>
    );
  }
  if (error) {
    return (
      <div className="mb-safe-bottom mt-14 h-full overflow-hidden pt-safe-top">
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

export interface EpisodeAudioPlayerProps {
  currentTrackId: string;
  currentTrackStreamUrls: StreamUrls;
}
export function EpisodeAudioPlayer({
  currentTrackId,
  currentTrackStreamUrls,
}: EpisodeAudioPlayerProps) {
  const episode = useGetEpisode(currentTrackId);
  const playing = usePlayerPlaying();
  const volume = usePlayerVolume();
  const playerActions = usePlayerActions();
  const cuePosition = usePlayerCuePosition();
  const playerLoadingStatus = usePlayerLoadingStatus();

  function onPlayProgressChange(progress: number) {
    playerActions.setProgress(progress);
  }

  function onPlayerReady(audioDuration: number) {
    playerActions.setLoadingStatus("loaded");
    playerActions.setTrackDuration(audioDuration);
  }

  useEffect(() => {
    if (playerLoadingStatus === "loaded") {
      setNavigatorMediaMetadata(episode);
    }
  }, [episode, playerLoadingStatus]);

  function onPause() {
    playerActions.pause();
  }

  function onPlay() {
    playerActions.resume();
    setNavigatorMediaMetadata(episode);
  }

  return (
    <AudioPlayer
      playing={playing}
      onReady={onPlayerReady}
      mp3StreamUrl={currentTrackStreamUrls.http_mp3_128_url}
      onPlayProgressChange={onPlayProgressChange}
      onPause={onPause}
      onPlay={onPlay}
      volume={volume}
      cuePosition={cuePosition}
    />
  );
}

function setNavigatorMediaMetadata(episode: ReturnType<typeof useGetEpisode>) {
  if ("mediaSession" in navigator) {
    const prefixMap = {
      soulection: "Soulection on",
      "sasha-marie-radio": "Sasha Marie on",
    };

    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.name,
      artist: `${prefixMap[episode.collective_slug]} ${formatDate(
        episode.created_time
      )}`,
      artwork: [
        {
          src: episode.picture_large,
          sizes: "96x96",
          type: "image/jpg",
        },
        {
          src: episode.picture_large,
          sizes: "128x128",
          type: "image/jpg",
        },
        {
          src: episode.picture_large,
          sizes: "192x192",
          type: "image/jpg",
        },
        {
          src: episode.picture_large,
          sizes: "256x256",
          type: "image/jpg",
        },
        {
          src: episode.picture_large,
          sizes: "384x384",
          type: "image/jpg",
        },
        {
          src: episode.picture_large,
          sizes: "512x512",
          type: "image/jpg",
        },
      ],
    });
  }
}
