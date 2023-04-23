import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import Player, { USE_NEW_PLAYER } from "./Player";
import { ShuffleButton } from "../components/ShuffleButton";
import EpisodeListSpinner from "./EpisodeList/EpisodeListSpinner";
import { EpisodeList } from "./EpisodeList";
import { useTracksScreenContainer } from "./TracksScreenContainer";
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
import { motion } from "framer-motion";

type Props = {
  searchText: string;
};

function TracksScreen({ searchText }: Props) {
  const [activeSection, setActiveSection] = React.useState<"all" | "favorites">(
    "all"
  );

  const isEpisodeModalSheetOpen = useEpisodeModalSheetStore((s) => s.isOpen);
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  const { data: episodes, error } = useEpisodes();

  const {
    currentTrackId,
    onTrackClick,
    onRandomClick,
    currentTrackStreamUrls,
    playing,
    volume,
  } = useTracksScreenContainer();

  const { addFavorite, removeFavorite } = useFavorites();
  const setContextMenuTrack = useTrackOptionsStore((state) => state.setTrack);
  const favoritesCount = useFavoritesCount();
  const isFavoriteFast = useIsFavoriteFast();

  const favorites = useMemo(() => {
    if (episodes) {
      return episodes.filter((episode) => isFavoriteFast(episode._id));
    }

    return [];
  }, [episodes, favoritesCount]);

  const deferredSearchText = useDeferredValue(searchText);
  const defferedActiveSection = useDeferredValue(activeSection);

  const filteredTracks = useMemo(() => {
    if (episodes) {
      if (!deferredSearchText.trim()) {
        return episodes;
      }

      return episodes.filter((episode) =>
        episode.name
          .toLocaleLowerCase()
          .includes(deferredSearchText.toLocaleLowerCase())
      );
    }

    return [];
  }, [episodes, deferredSearchText]);

  const activeTracks =
    defferedActiveSection === "favorites" ? favorites : filteredTracks;

  function onFavoriteClick(episode: ITrack) {
    if (isFavoriteFast(episode._id)) {
      removeFavorite(episode._id);
    } else {
      addFavorite(episode._id);
    }
  }

  const isWideScreen = useMedia("(min-width: 768px)");

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
                numEpisodes={activeTracks.length}
                activeSection={activeSection}
                onSectionClick={(section) => setActiveSection(section)}
              />
              {defferedActiveSection === "favorites" ? (
                <motion.div
                  key="favorites"
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.5 }}
                >
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
                </motion.div>
              ) : (
                <motion.div
                  key="filtered"
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.5 }}
                >
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
                </motion.div>
              )}
            </>
          </EpisodeList>
        </div>
        <div className="fixed right-0 bottom-0 z-20 w-full bg-white pb-safe-bottom">
          {shouldShowSuffleButton && (
            <div className="absolute bottom-full mb-2 flex w-full justify-end pr-4 md:mb-4">
              <ShuffleButton onClick={onRandomClick} />
            </div>
          )}
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
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.name,
      artist: `Soulection on ${formatDate(episode.created_time)}`,
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
