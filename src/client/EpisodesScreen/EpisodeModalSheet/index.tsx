import {
  IconSoundcloud,
  HeartFilled,
  HeartOutline,
  IconPlay,
  IconPause,
  IconBackThirty,
  IconSkipThirty,
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
  usePlayerCuePosition,
} from "../PlayerStore";
import { useGetEpisode } from "../useEpisodeHooks";
import Sheet from "react-modal-sheet";
import { useEffect, useRef, useState } from "react";
import create from "zustand";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { EpisodeTrackProjection } from "@/server/router";

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
  }),
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

type TracksAreaVariant = "half" | "tall" | "full" | "morph";

const tracksAreaVariants: { id: TracksAreaVariant; label: string }[] = [
  { id: "half", label: "Half" },
  { id: "tall", label: "Tall" },
  { id: "full", label: "Full" },
  { id: "morph", label: "Morph" },
];

const tracksAreaVariantStorageKey = "soulector:tracks-area-variant";

function useTracksAreaVariant() {
  const [variant, setVariant] = useState<TracksAreaVariant>("half");

  useEffect(() => {
    const saved = window.localStorage.getItem(tracksAreaVariantStorageKey);
    if (tracksAreaVariants.some((v) => v.id === saved)) {
      setVariant(saved as TracksAreaVariant);
    }
  }, []);

  function changeVariant(next: TracksAreaVariant) {
    setVariant(next);
    window.localStorage.setItem(tracksAreaVariantStorageKey, next);
  }

  return [variant, changeVariant] as const;
}

function TracksVariantSwitcher({
  variant,
  onChange,
}: {
  variant: TracksAreaVariant;
  onChange: (v: TracksAreaVariant) => void;
}) {
  return (
    <div className="flex w-full items-center justify-between px-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
        Tracks layout
      </div>
      <div className="flex rounded-full bg-black/20 p-0.5">
        {tracksAreaVariants.map((v) => (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold text-white/70",
              variant === v.id && "bg-white !text-accent",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EpisodeSheetCompactTitle({ episodeId }: { episodeId: string }) {
  const episode = useGetEpisode(episodeId);
  return (
    <div className="flex w-full items-center space-x-3 px-4">
      <img
        className="h-12 w-12 shrink-0 rounded-md object-cover"
        src={episode.artworkUrl}
        alt={episode.name}
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate font-bold text-white">{episode.name}</div>
        <div className="text-sm text-white/80">
          {formatDate(episode.releasedAt)}
        </div>
      </div>
    </div>
  );
}

function CompactSheetPlayerControls() {
  const playing = usePlayerPlaying();
  const loadingStatus = usePlayerLoadingStatus();
  const playerActions = usePlayerActions();
  const loading = loadingStatus === "loading";

  return (
    <div className="flex shrink-0 items-center space-x-1">
      <button
        title="Rewind 30 seconds"
        onClick={() => playerActions.rewind(30)}
        className="rounded-full p-1 text-white hover:text-white/80 focus:outline-none"
      >
        <IconBackThirty className="h-7 w-7 fill-current" />
      </button>
      <button
        disabled={loading}
        onClick={() => (playing ? playerActions.pause() : playerActions.resume())}
        className="rounded-full bg-white p-2 leading-none text-accent shadow-md focus:outline-none"
      >
        {loading ? (
          <svg
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 animate-ping p-1"
          >
            <circle cx="10" cy="10" r="9" fill="currentColor" />
          </svg>
        ) : playing ? (
          <IconPause className="h-6 w-6 fill-current" />
        ) : (
          <IconPlay className="h-6 w-6 fill-current" />
        )}
      </button>
      <button
        title="Forward 30 seconds"
        onClick={() => playerActions.forward(30)}
        className="rounded-full p-1 text-white hover:text-white/80 focus:outline-none"
      >
        <IconSkipThirty className="h-7 w-7 fill-current" />
      </button>
    </div>
  );
}

function PlayerProgressHairline() {
  const progress = usePlayerProgress();
  const episodeDuration = usePlayerEpisodeDuration();
  const pct =
    episodeDuration > 0 ? Math.min(100, (progress / episodeDuration) * 100) : 0;

  return (
    <div className="h-0.5 w-full bg-white/20">
      <div className="h-full bg-white/90" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EpisodeSheetActionButtons({ episodeId }: { episodeId: string }) {
  const episode = useGetEpisode(episodeId);
  return (
    <div className="grid w-full grid-cols-2 gap-x-2 px-4">
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
  );
}

function EpisodeSheetContent({ episodeId }: { episodeId: string }) {
  const { hasTracks } = useEpisodeTracks(episodeId);
  const [tracksVariant, setTracksVariant] = useTracksAreaVariant();

  if (hasTracks && tracksVariant === "full") {
    return (
      <EpisodeSheetFullContent
        episodeId={episodeId}
        switcher={
          <TracksVariantSwitcher
            variant={tracksVariant}
            onChange={setTracksVariant}
          />
        }
      />
    );
  }

  if (hasTracks && tracksVariant === "morph") {
    return (
      <EpisodeSheetMorphContent
        episodeId={episodeId}
        switcher={
          <TracksVariantSwitcher
            variant={tracksVariant}
            onChange={setTracksVariant}
          />
        }
      />
    );
  }

  return (
    <EpisodeSheetStackedContent
      episodeId={episodeId}
      variant={tracksVariant}
      switcher={
        <TracksVariantSwitcher
          variant={tracksVariant}
          onChange={setTracksVariant}
        />
      }
    />
  );
}

/**
 * "Half" / "Tall" variants (also the fallback when the episode has no
 * tracks): full artwork, player, and action buttons stacked, with the
 * tracks area taking a fixed share of the sheet height.
 */
function EpisodeSheetStackedContent({
  episodeId,
  variant,
  switcher,
}: {
  episodeId: string;
  variant: TracksAreaVariant;
  switcher: React.ReactNode;
}) {
  const episode = useGetEpisode(episodeId);
  const { hasTracks } = useEpisodeTracks(episodeId);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between space-y-3 overflow-auto pb-safe-top">
      <div className="w-full flex-col space-y-3 px-4 md:px-6 pt-6">
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
      <EpisodeSheetActionButtons episodeId={episodeId} />
      {hasTracks && (
        <>
          {switcher}
          <div
            className={cn(
              "relative mx-3 flex shrink-0 flex-col self-stretch rounded-lg",
              variant === "tall"
                ? "h-[62%] min-h-[16rem]"
                : "h-1/2 min-h-[14rem]",
            )}
          >
            <div className="absolute rounded-lg inset-0 bg-black/20"></div>
            <div className="relative min-h-0 overflow-y-auto">
              <EpisodeTracksList key={variant} episodeId={episodeId} />
            </div>
          </div>
        </>
      )}
      <br />
    </div>
  );
}

/**
 * "Full" variant: the tracks take all the space between a compact title
 * row at the top and the untouched full player controls docked at the
 * bottom.
 */
function EpisodeSheetFullContent({
  episodeId,
  switcher,
}: {
  episodeId: string;
  switcher: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full w-full flex-col space-y-3 overflow-hidden pb-safe-top pt-4">
      <EpisodeSheetCompactTitle episodeId={episodeId} />
      {switcher}
      <div className="relative mx-3 flex min-h-0 flex-1 flex-col rounded-lg">
        <div className="absolute rounded-lg inset-0 bg-black/20"></div>
        <div className="relative min-h-0 overflow-y-auto">
          <EpisodeTracksList episodeId={episodeId} />
        </div>
      </div>
      <div className="w-full px-6">
        <EpisodeSheetPlayer episodeId={episodeId} />
      </div>
    </div>
  );
}

/**
 * "Morph" variant: the sheet scrolls as one column, and once the user
 * scrolls past the artwork a compact header (thumbnail, title, inline
 * player controls, progress hairline) slides in over the top, leaving
 * the rest of the sheet to the tracks.
 */
function EpisodeSheetMorphContent({
  episodeId,
  switcher,
}: {
  episodeId: string;
  switcher: React.ReactNode;
}) {
  const episode = useGetEpisode(episodeId);
  const [collapsed, setCollapsed] = useState(false);

  function onSheetScroll(e: React.UIEvent<HTMLDivElement>) {
    const top = e.currentTarget.scrollTop;
    // hysteresis so the header doesn't flicker around the threshold
    setCollapsed((c) => (c ? top > 150 : top > 190));
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 bg-accent transition-all duration-300",
          collapsed
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0",
        )}
      >
        <div className="flex w-full items-center space-x-3 px-4 py-2">
          <img
            className="h-12 w-12 shrink-0 rounded-md object-cover"
            src={episode.artworkUrl}
            alt={episode.name}
          />
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-bold text-white">
              {episode.name}
            </div>
            <div className="text-xs text-white/80">
              {formatDate(episode.releasedAt)}
            </div>
          </div>
          <CompactSheetPlayerControls />
        </div>
        <PlayerProgressHairline />
      </div>
      <div
        onScroll={onSheetScroll}
        className="flex h-full w-full flex-col items-center space-y-3 overflow-y-auto pb-safe-top"
      >
        <div
          className={cn(
            "w-full flex-col space-y-3 px-4 pt-6 transition-all duration-300",
            collapsed && "scale-95 opacity-0",
          )}
        >
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
        <div
          className={cn(
            "w-full px-6 transition-opacity duration-300",
            collapsed && "opacity-0",
          )}
        >
          <EpisodeSheetPlayer episodeId={episodeId} />
        </div>
        <EpisodeSheetActionButtons episodeId={episodeId} />
        {switcher}
        <div className="relative mx-3 self-stretch rounded-lg">
          <div className="absolute rounded-lg inset-0 bg-black/20"></div>
          <div className="relative">
            <EpisodeTracksList episodeId={episodeId} />
          </div>
        </div>
        <br />
      </div>
    </div>
  );
}

export function useEpisodeTracks(episodeId: string, enabled: boolean = true) {
  const { data, status } = trpc["episode.getTracks"].useQuery(
    {
      episodeId,
    },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      enabled,
    },
  );

  return {
    data,
    loaded: status === "success",
    hasTracks: status === "success" && data.length > 0,
  };
}

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function EpisodeTracksList({ episodeId }: { episodeId: string }) {
  const progress = usePlayerProgress();
  const playerActions = usePlayerActions();
  const progressSecs = progress / 1000;

  const { data, status } = trpc["episode.getTracks"].useQuery(
    {
      episodeId,
    },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  );

  const loaded = status === "success";
  const loadedData = loaded ? (data ? data : []) : [];

  const possibleTracks = loadedData.filter((t) =>
    t.timestamp ? progressSecs >= t.timestamp : false,
  );

  const currentTrack = possibleTracks.at(-1);
  const currentTrackOrder = currentTrack?.order;

  const currentTrackRef = useRef<HTMLButtonElement | null>(null);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (currentTrackOrder == null) {
      return;
    }

    function centerCurrentTrack(behavior: ScrollBehavior) {
      const el = currentTrackRef.current;
      if (!el) return;
      const container = getScrollParent(el);
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const delta =
        elRect.top -
        containerRect.top -
        (container.clientHeight - elRect.height) / 2;
      container.scrollTo({
        top: container.scrollTop + delta,
        behavior,
      });
    }

    const isFirstCenter = !hasCenteredRef.current;
    hasCenteredRef.current = true;
    centerCurrentTrack(isFirstCenter ? "auto" : "smooth");

    // on desktop the tracks panel animates open, so the container may not
    // have its final height yet on first render; re-center once it settles
    let timeout: number | undefined;
    if (isFirstCenter) {
      timeout = window.setTimeout(() => centerCurrentTrack("auto"), 350);
    }
    return () => window.clearTimeout(timeout);
  }, [currentTrackOrder]);

  function onTrackClick(t: EpisodeTrackProjection) {
    if (t.timestamp) {
      playerActions.setCuePosition(t.timestamp * 1000);
    }
  }

  return loaded && loadedData.length > 0 ? (
    <div className="xs:slide-in-from-bottom-3 md:fade-in xs:animate-in duration-600 relative">
      <div className="py-1" />
      <div className="py-4 rounded-lg text-white relative border-accent">
        {/* <div className="absolute rounded-lg inset-0 bg-black/20"></div> */}
        <div className="relative px-4 font-bold text-white text-lg mb-4">
          {loadedData.length} Tracks
        </div>
        <div className="relative space-y">
          {loadedData.map((t, i) => {
            const isCurrent = currentTrack?.order === t.order;
            return (
              <button
                key={`${t.order}-${i}`}
                ref={isCurrent ? currentTrackRef : undefined}
                onClick={() => onTrackClick(t)}
                className={cn("w-full relative hover:bg-white/10")}
              >
                <div
                  data-current-track={isCurrent}
                  className={cn(
                    "absolute w-[2px] md:w-[4px] inset-y-0 bg-white opacity-0 fade-in-100 data-[current-track=true]:opacity-100 data-[current-track=true]:animate-in",
                  )}
                ></div>
                <div className="space-x-5 relative flex w-full justify-between items-center px-4 md:px-4 py-2">
                  <div className="flex text-left items-center space-x-3 relative w-full">
                    <div
                      className={cn(
                        "text-xs h-5 w-5 inline-flex p-1 items-center justify-center relative",
                        isCurrent && "bg-white text-accent rounded-full",
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
                          isCurrent && "!font-bold md:!font-black",
                        )}
                      >
                        {t.name}
                      </div>
                      <div
                        className={cn(
                          "text-white/80 text-sm",
                          isCurrent && "text-white/100",
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
