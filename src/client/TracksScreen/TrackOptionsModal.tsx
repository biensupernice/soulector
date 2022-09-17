import { BottomSheet } from "react-spring-bottom-sheet";
import create from "zustand";
import { ITrack } from "@/client/TracksScreen/TracksStore";
import { formatDate, formatTimeSecs } from "@/client/helpers";
import cx from "classnames";
import {
  HeartFilled,
  HeartOutline,
  IconPlay,
  IconSoundcloud,
} from "@/client/components/Icons";
import { useFavorites } from "@/client/TracksScreen/FavoritesStore";
import { usePlayerStore } from "@/client/TracksScreen/PlayerStore";

export function TrackOptionsModal() {
  const open = useTrackOptionsStore((state) => state.open);
  const track = useTrackOptionsStore((state) => state.track);
  const onClose = useTrackOptionsStore((state) => state.onClose);

  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const play = usePlayerStore((state) => state.play);

  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  const isPlaying = currentTrackId === track?._id ?? false;
  const isFavorited = isFavorite(track?._id ?? "");

  return (
    <BottomSheet
      open={open}
      onDismiss={onClose}
      className="rsbs-not-full-height"
      snapPoints={({ minHeight }) => minHeight * 1.1}
    >
      <div className="mb-safe-bottom w-full">
        {track ? (
          <div className="flex flex-col space-y-2 w-full">
            <div className="flex items-center space-x-4 w-full p-3">
              <div className="flex-shrink-0 h-24 w-24 rounded-lg overflow-hidden relative">
                <img
                  className="w-full h-full bg-gray-200"
                  src={track.picture_large}
                  alt={track.name}
                />
              </div>
              <div className="ml-2 flex-col space-y-1">
                <div className={cx("font-bold leading-tight text-lg")}>
                  {track.name}
                </div>
                <div className="text-base text-gray-700">
                  <span>{formatDate(track.created_time)}</span>
                  <span className="mx-1 inline-block">&bull;</span>
                  <span className="inline-block">
                    {formatTimeSecs(track.duration)}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full">
              {!isPlaying ? (
                <button
                  className={cx(
                    "w-full font-medium flex space-x-4 px-4 py-4 items-center",
                    "active:bg-slate-200",
                    "focus:outline-none"
                  )}
                  onClick={() => {
                    play(track._id);
                    onClose();
                  }}
                >
                  <IconPlay className="w-5 h-5" />
                  <span>Play Episode</span>
                </button>
              ) : null}
              <button
                className={cx(
                  "w-full font-medium flex space-x-4 px-4 py-4 items-center",
                  "active:bg-slate-200",
                  "focus:outline-none"
                )}
                title="Add to favorites"
                onClick={(e) => {
                  e.preventDefault();
                  if (isFavorited) {
                    removeFavorite(track._id);
                  } else {
                    addFavorite(track._id);
                  }
                  onClose();
                }}
              >
                {isFavorited ? (
                  <>
                    <HeartFilled className="stroke-current w-5 h-5 text-gray-500" />
                    <div>Remove from Favorites</div>
                  </>
                ) : (
                  <>
                    <HeartOutline className="stroke-current w-5 h-5 text-gray-500" />
                    <div>Add to Favorites</div>
                  </>
                )}
              </button>
              {track.source === "SOUNDCLOUD" ? (
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={track.url}
                  className={cx(
                    "w-full font-medium flex space-x-4 px-4 py-4 just items-center",
                    "active:bg-slate-200",
                    "focus:outline-none"
                  )}
                  title="Add to favorites"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <IconSoundcloud className="stroke-current w-5 h-5" />
                  <div>Open in SoundCloud</div>
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
interface TrackOptionsStore {
  open: boolean;
  track: ITrack | null;
  onClose: () => void;
  setTrack: (track: ITrack) => void;
}
export const useTrackOptionsStore = create<TrackOptionsStore>((set, get) => ({
  open: false,
  track: null,
  onClose: () => set({ open: false }),
  setTrack: (track: ITrack) => set({ open: true, track }),
}));