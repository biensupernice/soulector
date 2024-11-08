import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Player, { USE_NEW_PLAYER } from "./Player";
import { ShuffleButton } from "../components/ShuffleButton";
import EpisodeListSpinner from "./EpisodeList/EpisodeListSpinner";
import { EpisodeList } from "./EpisodeList";
import { useEpisodesScreenState } from "./useEpisodesScreenState";
import { useEpisodeAlbumArtColors } from "./useEpisodeAlbumArtColors";
import { EpisodeListError } from "./EpisodeList/EpisodeListError";
import {
  useFavorites,
  useFavoritesCount,
  useIsFavoriteFast,
} from "./FavoritesStore";
import classNames from "classnames";
import { useEpisodes, useGetEpisode } from "./useEpisodeHooks";
import { EpisodeListHeader } from "./EpisodeListHeader";
import { useEpisodeOptionsStore } from "./EpisodeOptionsModal";
import { Episode } from "../components/Episode";
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
import { EpisodeProjection } from "@/server/router";
import { EpisodeListContext } from "@/pages";

type Props = {
  searchText: string;
};

export function EpisodesScreen({ searchText }: Props) {
  const [selectedSection, setSelectedSection] = useState<"all" | "favorites">(
    "all",
  );
  const [activeSection, setActiveSection] = useState<"all" | "favorites">(
    "all",
  );
  const [isPending, startTransition] = useTransition();

  const isEpisodeModalSheetOpen = useEpisodeModalSheetStore((s) => s.isOpen);
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  const { data: episodes, error } = useEpisodes();

  const loadPersistedCollective = useCollectiveSelectStore(
    (s) => s.loadPersisted,
  );

  const { ref: episodeListRef } = useContext(EpisodeListContext);

  useEffect(() => {
    loadPersistedCollective();
  }, []);

  const {
    currentEpisodeId,
    onEpisodeClick,
    onRandomClick,
    currentEpisodeStreamUrls,
  } = useEpisodesScreenState();

  const { addFavorite, removeFavorite } = useFavorites();
  const setContextMenuEpisode = useEpisodeOptionsStore(
    (state) => state.setEpisode,
  );
  const favoritesCount = useFavoritesCount();
  const isFavoriteFast = useIsFavoriteFast();
  const selectedCollective = useCollectiveSelectStore((s) => s.selected);

  useEpisodeAlbumArtColors();

  const favorites = useMemo(() => {
    if (episodes) {
      let eps = episodes;

      if (selectedCollective !== "all") {
        eps = episodes.filter((ep) => ep.collectiveSlug === selectedCollective);
      }

      return eps.filter((episode) => isFavoriteFast(episode.id));
    }

    return [];
  }, [episodes, favoritesCount, selectedCollective]);

  const searchOpen = useNavbarStore((state) => state.searchOpen);
  const openSearch = useNavbarStore((state) => state.openSearch);

  const filteredEpisodes = useMemo(() => {
    if (episodes) {
      let eps = episodes;

      if (selectedCollective !== "all") {
        eps = episodes.filter((ep) => ep.collectiveSlug === selectedCollective);
      }

      if (!searchText.trim()) {
        return eps;
      }

      const lowerCaseSearch = searchText.toLowerCase();
      return eps.filter((episode) =>
        episode.name.toLowerCase().includes(lowerCaseSearch),
      );
    }

    return [];
  }, [episodes, searchText, selectedCollective]);

  const activeEpisodes = activeSection === "all" ? filteredEpisodes : favorites;

  function onFavoriteClick(episode: EpisodeProjection) {
    if (isFavoriteFast(episode.id)) {
      removeFavorite(episode.id);
    } else {
      addFavorite(episode.id);
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
            currentEpisodeId && "mb-24",
          )}
        >
          <EpisodeList ref={episodeListRef}>
            <>
              <EpisodeListHeader
                rightContent={
                  <div className="font-semibold text-gray-600">
                    {activeEpisodes.length} Total
                  </div>
                }
                filterText={searchText}
                activeSection={selectedSection}
                onSectionClick={onSectionClick}
              />
              {activeSection === "favorites" ? (
                <div>
                  {favorites.map((episode) => (
                    <Episode
                      key={episode.id}
                      onClick={() => onEpisodeClick(episode.id)}
                      episode={episode}
                      selected={episode.id === currentEpisodeId}
                      favorite={isFavoriteFast(episode.id)}
                      onOptionsClick={() => setContextMenuEpisode(episode)}
                      onFavoriteClick={() => onFavoriteClick(episode)}
                    />
                  ))}
                </div>
              ) : (
                <div>
                  {filteredEpisodes.map((episode) => (
                    <Episode
                      key={episode.id}
                      onClick={() => onEpisodeClick(episode.id)}
                      episode={episode}
                      selected={episode.id === currentEpisodeId}
                      favorite={isFavoriteFast(episode.id)}
                      onOptionsClick={() => setContextMenuEpisode(episode)}
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
                  !searchOpen && "flex sm:hidden",
                )}
              >
                <IconSearch className="h-5 w-5 fill-current" />
                <div>Search</div>
              </button>
              <ShuffleButton onClick={onRandomClick} />
            </div>
          ) : null}
          {currentEpisodeId && <Player currentEpisodeId={currentEpisodeId} />}
          {USE_NEW_PLAYER && currentEpisodeId && currentEpisodeStreamUrls && (
            <EpisodeAudioPlayer
              currentEpisodeId={currentEpisodeId}
              currentEpisodeStreamUrls={currentEpisodeStreamUrls}
            />
          )}
        </div>
        {!isWideScreen && (
          <EpisodeModalSheet
            episodeId={currentEpisodeId}
            showEpisodeModal={isEpisodeModalSheetOpen}
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

export interface EpisodeAudioPlayerProps {
  currentEpisodeId: string;
  currentEpisodeStreamUrls: StreamUrls;
}
export function EpisodeAudioPlayer({
  currentEpisodeId,
  currentEpisodeStreamUrls,
}: EpisodeAudioPlayerProps) {
  const episode = useGetEpisode(currentEpisodeId);
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
    playerActions.setEpisodeDuration(audioDuration);
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
      mp3StreamUrl={currentEpisodeStreamUrls.http_mp3_128_url}
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
      "the-love-below-hour": "The Love Below on",
      local: "Local Selector on",
    };

    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.name,
      artist: `${prefixMap[episode.collectiveSlug]} ${formatDate(
        episode.releasedAt,
      )}`,
      artwork: [
        {
          src: episode.artworkUrl,
          sizes: "96x96",
          type: "image/jpg",
        },
        {
          src: episode.artworkUrl,
          sizes: "128x128",
          type: "image/jpg",
        },
        {
          src: episode.artworkUrl,
          sizes: "192x192",
          type: "image/jpg",
        },
        {
          src: episode.artworkUrl,
          sizes: "256x256",
          type: "image/jpg",
        },
        {
          src: episode.artworkUrl,
          sizes: "384x384",
          type: "image/jpg",
        },
        {
          src: episode.artworkUrl,
          sizes: "512x512",
          type: "image/jpg",
        },
      ],
    });
  }
}
