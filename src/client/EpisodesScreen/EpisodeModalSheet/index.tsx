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
  usePlayerCuePosition,
} from "../PlayerStore";
import { useGetEpisode } from "../useEpisodeHooks";
import Sheet from "react-modal-sheet";
import { motion } from "framer-motion";
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

type TracksAreaVariant = "half" | "morph";

const tracksAreaVariants: { id: TracksAreaVariant; label: string }[] = [
  { id: "half", label: "Half" },
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

  const switcher = (
    <TracksVariantSwitcher
      variant={tracksVariant}
      onChange={setTracksVariant}
    />
  );

  if (hasTracks && tracksVariant === "morph") {
    return (
      <EpisodeSheetMorphDetailsContent
        episodeId={episodeId}
        switcher={switcher}
      />
    );
  }

  return (
    <EpisodeSheetStackedContent episodeId={episodeId} switcher={switcher} />
  );
}

/**
 * "Half" variant (also the fallback when the episode has no tracks):
 * full artwork, player, and action buttons stacked, with the tracks
 * area taking half the sheet height.
 */
function EpisodeSheetStackedContent({
  episodeId,
  switcher,
}: {
  episodeId: string;
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
          <div className="relative mx-3 flex h-1/2 min-h-[14rem] shrink-0 flex-col self-stretch rounded-lg">
            <div className="absolute rounded-lg inset-0 bg-black/20"></div>
            <div className="relative min-h-0 overflow-y-auto">
              <EpisodeTracksList episodeId={episodeId} />
            </div>
          </div>
        </>
      )}
      <br />
    </div>
  );
}

const detailsMorphTransition = {
  type: "spring",
  bounce: 0.15,
  duration: 0.45,
} as const;

/**
 * "Morph" variant: same layout as "Half", but the user scrolling the
 * tracks list collapses the episode details into a compact thumbnail
 * row, and the tracks area grows into the freed space. The artwork and
 * title are shared elements (framer-motion layoutId) that travel
 * between their expanded and compact positions, while the player,
 * buttons, and tracks glide along via position layout animations.
 * Driven by user scroll direction only: scrolling down collapses,
 * scrolling up (or reaching the top) expands, and the list's own
 * programmatic active-track centering never toggles it.
 */
function EpisodeSheetMorphDetailsContent({
  episodeId,
  switcher,
}: {
  episodeId: string;
  switcher: React.ReactNode;
}) {
  const episode = useGetEpisode(episodeId);
  const [collapsed, setCollapsed] = useState(false);
  const lastScrollTopRef = useRef(0);
  const scrollAccumRef = useRef(0);

  function onTracksScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const top = el.scrollTop;
    const delta = top - lastScrollTopRef.current;
    lastScrollTopRef.current = top;

    if (isProgrammaticScroll(el)) {
      scrollAccumRef.current = 0;
      return;
    }

    if (top <= 8) {
      scrollAccumRef.current = 0;
      setCollapsed(false);
      return;
    }

    // accumulate travel in one direction; a direction flip starts over
    if (Math.sign(delta) !== Math.sign(scrollAccumRef.current)) {
      scrollAccumRef.current = 0;
    }
    scrollAccumRef.current += delta;

    if (scrollAccumRef.current > 48) {
      setCollapsed(true);
    } else if (scrollAccumRef.current < -48) {
      setCollapsed(false);
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center space-y-3 overflow-hidden pb-safe-top">
      {collapsed ? (
        <div className="flex w-full items-center space-x-3 px-4 pt-4">
          <motion.img
            layoutId="episode-sheet-details-artwork"
            transition={detailsMorphTransition}
            style={{ borderRadius: 6 }}
            className="h-12 w-12 shrink-0 object-cover"
            src={episode.artworkUrl}
            alt={episode.name}
          />
          <motion.div
            layoutId="episode-sheet-details-title"
            transition={detailsMorphTransition}
            className="min-w-0 flex-1 text-left"
          >
            <div className="truncate font-bold text-white">{episode.name}</div>
            <div className="text-sm text-white/80">
              {formatDate(episode.releasedAt)}
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="w-full flex-col space-y-3 px-4 pt-6">
          <motion.img
            layoutId="episode-sheet-details-artwork"
            transition={detailsMorphTransition}
            style={{ borderRadius: 8 }}
            className="min-h-40 min-w-40 mx-auto w-full max-w-sm object-fill"
            src={episode.artworkUrl}
            alt={episode.name}
          />
          <motion.div
            layoutId="episode-sheet-details-title"
            transition={detailsMorphTransition}
            className="flex w-full flex-col text-center"
          >
            <div className="font-bold text-white">{episode.name}</div>
            <div className="text-sm text-white/80">
              {formatDate(episode.releasedAt)}
            </div>
          </motion.div>
        </div>
      )}
      <motion.div
        layout="position"
        transition={detailsMorphTransition}
        className="w-full px-6"
      >
        <EpisodeSheetPlayer episodeId={episodeId} />
      </motion.div>
      <motion.div
        layout="position"
        transition={detailsMorphTransition}
        className="w-full"
      >
        <EpisodeSheetActionButtons episodeId={episodeId} />
      </motion.div>
      <motion.div
        layout="position"
        transition={detailsMorphTransition}
        className="w-full"
      >
        {switcher}
      </motion.div>
      <motion.div
        layout="position"
        transition={detailsMorphTransition}
        className="relative mx-3 flex min-h-[10rem] flex-1 flex-col self-stretch rounded-lg"
      >
        <div className="absolute rounded-lg inset-0 bg-black/20"></div>
        <div
          onScroll={onTracksScroll}
          className="relative min-h-0 overflow-y-auto"
        >
          <EpisodeTracksList episodeId={episodeId} />
        </div>
      </motion.div>
      <br />
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

/**
 * The tracks list auto-scrolls to center the active track, and those
 * programmatic scrolls must be distinguishable from user scrolling so
 * layouts like the Morph variant only react to the user. The container
 * gets stamped with a timestamp covering the smooth-scroll duration.
 */
function markProgrammaticScroll(container: HTMLElement) {
  container.dataset.programmaticScrollUntil = String(Date.now() + 800);
}

function isProgrammaticScroll(container: HTMLElement) {
  return Date.now() < Number(container.dataset.programmaticScrollUntil ?? 0);
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
      markProgrammaticScroll(container);
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
