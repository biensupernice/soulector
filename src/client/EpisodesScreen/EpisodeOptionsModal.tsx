import { BottomSheet } from "react-spring-bottom-sheet";
import create from "zustand";
import { formatDate, formatTimeSecs } from "@/client/helpers";
import cx from "classnames";
import {
  HeartFilled,
  HeartOutline,
  IconPlay,
  IconSoundcloud,
} from "@/client/components/Icons";
import {
  useFavorites,
  useIsFavoriteFast,
} from "@/client/EpisodesScreen/FavoritesStore";
import {
  usePlayerActions,
  usePlayerCurrentEpisodeId,
} from "@/client/EpisodesScreen/PlayerStore";
import { EpisodeProjection } from "@/server/router";
import { useEffect } from "react";
import Link from "next/link";

export function EpisodeOptionsModal() {
  const open = useEpisodeOptionsStore((state) => state.open);
  const episode = useEpisodeOptionsStore((state) => state.episode);
  const onClose = useEpisodeOptionsStore((state) => state.onClose);

  const currentEpisodeId = usePlayerCurrentEpisodeId();
  const playerActions = usePlayerActions();

  const { addFavorite, removeFavorite } = useFavorites();
  const isFavoriteFast = useIsFavoriteFast();

  const isPlaying = currentEpisodeId === episode?.id ?? false;
  const isFavorited = isFavoriteFast(episode?.id ?? "");

  return (
    <BottomSheet
      open={open}
      onDismiss={onClose}
      className="rsbs-not-full-height"
      snapPoints={({ minHeight }) => minHeight * 1.1}
    >
      <div className="mb-safe-bottom w-full">
        {episode ? (
          <div className="flex w-full flex-col space-y-2">
            <div className="flex w-full items-center space-x-4 p-3">
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
                <img
                  className="h-full w-full bg-gray-200"
                  src={episode.artworkUrl}
                  alt={episode.name}
                />
              </div>
              <div className="ml-2 flex-col space-y-1">
                <div className={cx("text-lg font-bold leading-tight")}>
                  {episode.name}
                </div>
                <div className="text-base text-gray-700">
                  <span>{formatDate(episode.releasedAt)}</span>
                  <span className="mx-1 inline-block">&bull;</span>
                  <span className="inline-block">
                    {formatTimeSecs(episode.duration)}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full">
              {!isPlaying ? (
                <button
                  className={cx(
                    "flex w-full items-center space-x-4 px-4 py-4 font-medium",
                    "active:bg-slate-200",
                    "focus:outline-none",
                  )}
                  onClick={() => {
                    playerActions.play(episode.id);
                    onClose();
                  }}
                >
                  <IconPlay className="h-5 w-5" />
                  <span>Play Episode</span>
                </button>
              ) : null}
              <button
                className={cx(
                  "flex w-full items-center space-x-4 px-4 py-4 font-medium",
                  "active:bg-slate-200",
                  "focus:outline-none",
                )}
                title="Add to favorites"
                onClick={(e) => {
                  e.preventDefault();
                  if (isFavorited) {
                    removeFavorite(episode.id);
                  } else {
                    addFavorite(episode.id);
                  }
                  onClose();
                }}
              >
                {isFavorited ? (
                  <>
                    <HeartFilled className="h-5 w-5 stroke-current text-gray-500" />
                    <div>Remove from Favorites</div>
                  </>
                ) : (
                  <>
                    <HeartOutline className="h-5 w-5 stroke-current text-gray-500" />
                    <div>Add to Favorites</div>
                  </>
                )}
              </button>
              {episode.source === "SOUNDCLOUD" ? (
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={episode.permalinkUrl}
                  className={cx(
                    "just flex w-full items-center space-x-4 px-4 py-4 font-medium",
                    "active:bg-slate-200",
                    "focus:outline-none",
                  )}
                  title="Add to favorites"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <IconSoundcloud className="h-5 w-5 stroke-current" />
                  <div>Open in SoundCloud</div>
                </a>
              ) : null}
              <Link href={`${episode.collectiveSlug}/${episode.id}`}>
                View Details
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
interface EpisodeOptionsStore {
  open: boolean;
  episode: EpisodeProjection | null;
  onClose: () => void;
  setEpisode: (episode: EpisodeProjection) => void;
}
export const useEpisodeOptionsStore = create<EpisodeOptionsStore>(
  (set, get) => ({
    open: false,
    episode: null,
    onClose: () => set({ open: false, episode: null }),
    setEpisode: (episode: EpisodeProjection) =>
      set({ open: true, episode: episode }),
  }),
);
