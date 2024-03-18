import {
  IconSoundcloud,
  HeartFilled,
  HeartOutline,
} from "@/client/components/Icons";
import { formatDate, formatTimeSecs } from "@/client/helpers";
import classNames from "classnames";
import { useFavorites, useIsFavoriteFast } from "../FavoritesStore";
import { MobilePlayerControls } from "../Player/MobilePlayerControls";
import {
  usePlayerPlaying,
  usePlayerVolume,
  usePlayerMuted,
  usePlayerProgress,
  usePlayerEpisodeDuration,
  usePlayerLoadingStatus,
  usePlayerActions,
} from "../PlayerStore";
import { useGetEpisode } from "../useEpisodeHooks";
import Sheet from "react-modal-sheet";
import create from "zustand";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";

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
  showEpisodeModal: boolean;
  onCloseModal: () => void;
  episodeId?: string;
}
export function EpisodeModalSheet({
  showEpisodeModal,
  onCloseModal,
  episodeId,
}: EpisodeModalSheetProps) {
  return (
    <Sheet
      className="full-height-sheet mx-auto w-full max-w-2xl"
      isOpen={showEpisodeModal}
      onClose={onCloseModal}
    >
      <Sheet.Container>
        <div className="absolute inset-0 bg-gradient-to-t from-gray-700/30 to-white/5"></div>
        <Sheet.Header />
        <Sheet.Content>
          {episodeId ? <EpisodeSheetContent episodeId={episodeId} /> : null}
        </Sheet.Content>
      </Sheet.Container>

      <Sheet.Backdrop />
    </Sheet>
  );
}

function EpisodeSheetContent({ episodeId }: { episodeId: string }) {
  const episode = useGetEpisode(episodeId);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between space-y-3 overflow-auto pb-safe-top">
      <div className="w-full flex-col space-y-3 px-6 pt-6">
        <img
          className="min-h-40 min-w-40 mx-auto w-full max-w-sm rounded-lg object-fill"
          src={episode.artworkUrl}
          alt={episode.name}
        />
        <div className="flex w-full flex-col text-center">
          <div className="font-bold text-white">{episode.name}</div>
          <div className="text-sm text-white/80">
            {formatDate(episode.releasedAt)}
          </div>
        </div>
      </div>
      <div className="w-full px-6">
        <EpisodeSheetPlayer episodeId={episodeId} />
      </div>
      <div className="grid w-full grid-cols-2 gap-x-2 px-6">
        <a
          href={episode.permalinkUrl}
          className="inline-flex w-full flex-1 items-center justify-center space-x-1 rounded-md border-2 border-white bg-transparent px-2 py-1 text-center text-xs font-semibold text-white"
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
      <EpisodeTracksList episodeId={episodeId} />
    </div>
  );
}

function EpisodeTracksList({ episodeId }: { episodeId: string }) {
  const progress = usePlayerProgress();
  const progressSecs = progress / 1000;

  const { data, status } = trpc["episode.getTracks"].useQuery({
    episodeId,
  });

  const loaded = status === "success";
  const loadedData = loaded ? (data ? data : []) : [];

  const possibleTracks = loadedData.filter((t) =>
    t.timestamp ? progressSecs >= t.timestamp : false
  );

  const currentTrack = possibleTracks.at(-1);

  return loaded && loadedData.length > 0 ? (
    <>
      <div className="py-1" />
      <div className="py-4 rounded-lg text-white relative mx-4 bg-accent shadow border-accent">
        <div className="absolute rounded-lg inset-0 bg-black/20"></div>
        <div className="relative px-4 font-bold text-white text-lg mb-4">
          {loadedData.length} Tracks
        </div>
        <div className="relative space-y">
          {loadedData.map((t, i) => {
            const isCurrent = currentTrack?.order === t.order;
            return (
              <div className="flex justify-between items-center px-4 py-2 space-x-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      "text-xs h-5 w-5 inline-flex p-1 items-center justify-center relative",
                      isCurrent && "bg-white text-accent rounded-full"
                    )}
                  >
                    {isCurrent && (
                      <div className="bg-white animate-ping [animation-duration:1500ms] absolute rounded-full origin-center p-2"></div>
                    )}
                    <div className="relative">{t.order}</div>
                  </div>
                  <div>
                    <div
                      className={cn(
                        "font-medium text-sm",
                        isCurrent && "!font-bold"
                      )}
                    >
                      {t.name}
                    </div>
                    <div
                      className={cn(
                        "text-white/80 text-sm",
                        isCurrent && "text-white/100"
                      )}
                    >
                      {t.artist}
                    </div>
                  </div>
                </div>
                {t.timestamp ? (
                  <div className="text-xs">{formatTimeSecs(t.timestamp)}</div>
                ) : (
                  <></>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  ) : null;
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
      className="inline-flex w-full items-center justify-center space-x-2 rounded-md border-2 border-white bg-transparent px-3 py-1 text-xs font-bold text-white"
    >
      {isFavorited ? (
        <>
          <HeartFilled className="h-3 w-3 fill-current text-white" />
          <div>Remove Favorite</div>
        </>
      ) : (
        <>
          <HeartOutline className="h-3 w-3 stroke-current text-white" />
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
  const episodeDuration = usePlayerEpisodeDuration();
  const loadingStatus = usePlayerLoadingStatus();
  const currentEpisode = useGetEpisode(episodeId);

  const playerActions = usePlayerActions();

  return (
    <MobilePlayerControls
      volume={volume}
      onVolumeChange={playerActions.setVolume}
      onPause={playerActions.pause}
      onResume={playerActions.resume}
      episode={currentEpisode}
      playing={playing}
      muted={muted}
      onMute={playerActions.mute}
      onUnmute={playerActions.unmute}
      progress={progress}
      onCuePositionChange={playerActions.setCuePosition}
      onForward={playerActions.forward}
      onRewind={playerActions.rewind}
      episodeDuration={episodeDuration}
      loading={loadingStatus === "loading"}
    />
  );
}
