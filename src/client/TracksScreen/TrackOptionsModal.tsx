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
import {
  useFavorites,
  useIsFavoriteFast,
} from "@/client/TracksScreen/FavoritesStore";
import {
  usePlayerActions,
  usePlayerCurrentTrackId,
} from "@/client/TracksScreen/PlayerStore";

export function TrackOptionsModal() {
  const open = useTrackOptionsStore((state) => state.open);
  const track = useTrackOptionsStore((state) => state.track);
  const onClose = useTrackOptionsStore((state) => state.onClose);

  const currentTrackId = usePlayerCurrentTrackId();
  const playerActions = usePlayerActions();

  const { addFavorite, removeFavorite } = useFavorites();
  const isFavoriteFast = useIsFavoriteFast();

  const isPlaying = currentTrackId === track?._id ?? false;
  const isFavorited = isFavoriteFast(track?._id ?? "");

  return (
    <BottomSheet
      open={open}
      onDismiss={onClose}
      className="rsbs-not-full-height"
      snapPoints={({ minHeight }) => minHeight * 1.1}
    >
      <div className="mb-safe-bottom w-full">
        {track ? (
          <div className="flex w-full flex-col space-y-2">
            <div className="flex w-full items-center space-x-4 p-3">
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
                <img
                  className="h-full w-full bg-gray-200"
                  src={track.picture_large}
                  alt={track.name}
                />
              </div>
              <div className="ml-2 flex-col space-y-1">
                <div className={cx("text-lg font-bold leading-tight")}>
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
                    "flex w-full items-center space-x-4 px-4 py-4 font-medium",
                    "active:bg-slate-200",
                    "focus:outline-none"
                  )}
                  onClick={() => {
                    playerActions.play(track._id);
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
              {track.source === "SOUNDCLOUD" ? (
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={track.url}
                  className={cx(
                    "just flex w-full items-center space-x-4 px-4 py-4 font-medium",
                    "active:bg-slate-200",
                    "focus:outline-none"
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
  onClose: () => set({ open: false, track: null }),
  setTrack: (track: ITrack) => set({ open: true, track }),
}));
