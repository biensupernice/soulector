import {
  IconSoundcloud,
  HeartFilled,
  HeartOutline,
} from "@/client/components/Icons";
import { formatDate } from "@/client/helpers";
import classNames from "classnames";
import { useFavorites, useIsFavoriteFast } from "../FavoritesStore";
import { MobilePlayerControls } from "../Player/PlayerControls";
import {
  usePlayerPlaying,
  usePlayerVolume,
  usePlayerMuted,
  usePlayerProgress,
  usePlayerTrackDuration,
  usePlayerLoadingStatus,
  usePlayerActions,
} from "../PlayerStore";
import { useGetEpisode } from "../TracksStore";
import Sheet from "react-modal-sheet";
import create from "zustand";

interface EpisodeModalSheetStore {
  isOpen: boolean;
  actions: {
    open: () => void;
    close: () => void;
  };
}
export const useEpisodeModalSheetStore = create<EpisodeModalSheetStore>(
  (set) => ({
    isOpen: false,
    actions: {
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    },
  })
);

export const useEpisodeModalSheetActions = () =>
  useEpisodeModalSheetStore((s) => s.actions);

interface EpisodeModalSheetProps {
  showTrackModal: boolean;
  onCloseModal: () => void;
  episodeId: string;
}
export function EpisodeModalSheet({
  showTrackModal,
  onCloseModal,
  episodeId,
}: EpisodeModalSheetProps) {
  const episode = useGetEpisode(episodeId);

  return (
    <Sheet
      className="mx-auto w-full max-w-md"
      isOpen={showTrackModal}
      onClose={onCloseModal}
    >
      <Sheet.Container>
        <Sheet.Header />
        <Sheet.Content>
          <div className="relative flex h-full w-full flex-col items-center justify-start space-y-3 overflow-auto pb-8">
            <div className="w-full flex-col space-y-3 px-6">
              <img
                className="min-h-40 min-w-40 mx-auto w-full max-w-sm rounded-lg object-fill"
                src={episode.picture_large}
                alt={episode.name}
              />
              <div className="flex w-full flex-col text-center">
                <div className="font-bold">{episode.name}</div>
                <div className="text-sm text-gray-500">
                  {formatDate(episode.created_time)}
                </div>
              </div>
            </div>
            <div className="w-full px-6">
              <EpisodeSheetPlayer episodeId={episodeId} />
            </div>
            <div className="grid grid-cols-2 gap-x-2 px-6">
              <a
                href={episode.url}
                className="flex w-full items-center justify-center space-x-1 rounded-md bg-zinc-200 bg-opacity-50 py-1 px-3 text-xs font-semibold text-indigo-600"
              >
                <span
                  className={classNames("inline-block rounded-full p-1")}
                  title="Open in SoundCloud"
                >
                  <IconSoundcloud className="h-4 w-4 fill-current" />
                </span>
                <span>Open in SoundCloud</span>
              </a>
              <EpisodeSheetFavoriteToggle episodeId={episodeId} />
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>

      <Sheet.Backdrop />
    </Sheet>
  );
}

export interface EpisodeSheetFavoriteToggleProps {
  episodeId: string;
}
export function EpisodeSheetFavoriteToggle({
  episodeId,
}: EpisodeSheetFavoriteToggleProps) {
  const { addFavorite, removeFavorite } = useFavorites();
  const isFavoriteFast = useIsFavoriteFast();
  const isFavorited = isFavoriteFast(episodeId);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        if (isFavorited) {
          removeFavorite(episodeId);
        } else {
          addFavorite(episodeId);
        }
      }}
      className="flex w-full items-center justify-center space-x-2 rounded-md bg-zinc-200 bg-opacity-50 py-1 px-3 text-xs font-semibold text-indigo-600"
    >
      {isFavorited ? (
        <>
          <HeartFilled className="h-3 w-3 fill-current text-indigo-500" />
          <div>Remove Favorite</div>
        </>
      ) : (
        <>
          <HeartOutline className="h-3 w-3 stroke-current text-indigo-500" />
          <div>Add Favorite</div>
        </>
      )}
    </button>
  );
}

export interface EpisodeSheetPlayerProps {
  episodeId: string;
}
export function EpisodeSheetPlayer({ episodeId }: EpisodeSheetPlayerProps) {
  const playing = usePlayerPlaying();
  const volume = usePlayerVolume();
  const muted = usePlayerMuted();
  const progress = usePlayerProgress();
  const trackDuration = usePlayerTrackDuration();
  const loadingStatus = usePlayerLoadingStatus();
  const currentTrack = useGetEpisode(episodeId);

  const playerActions = usePlayerActions();

  return (
    <MobilePlayerControls
      volume={volume}
      onVolumeChange={playerActions.setVolume}
      onPause={playerActions.pause}
      onResume={playerActions.resume}
      track={currentTrack}
      playing={playing}
      muted={muted}
      onMute={playerActions.mute}
      onUnmute={playerActions.unmute}
      progress={progress}
      onCuePositionChange={playerActions.setCuePosition}
      onForward={playerActions.forward}
      onRewind={playerActions.rewind}
      trackDuration={trackDuration}
      loading={loadingStatus === "loading"}
    />
  );
}
