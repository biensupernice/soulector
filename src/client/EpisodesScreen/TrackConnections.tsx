import { useContext, useEffect, useRef } from "react";
import { formatDate, formatTimeSecs } from "@/client/helpers";
import { EpisodeListContext } from "@/pages";
import { TrackAppearance, useTrackGraph } from "./useTrackGraph";
import { useTracksPanelActions } from "./TracksPanelStore";
import { useEpisodesScreenState } from "./useEpisodesScreenState";
import { useCollectiveSelectStore } from "./Navbar";

/**
 * Taking a crossing: play the set on the other side, from the moment the
 * shared record lands in it, and leave the list showing where you ended up.
 */
export function useHopToConnection() {
  const { onTrackClick } = useEpisodesScreenState();
  const tracksPanelActions = useTracksPanelActions();
  const { focusEpisode, clearSearch } = useContext(EpisodeListContext);
  const selectCollective = useCollectiveSelectStore((s) => s.setSelected);

  return function hopTo(
    targetEpisodeId: string,
    targetOrder: number,
    timestamp?: number,
  ) {
    // The graph spans the whole archive, but the list in front of you may be
    // narrowed to one collective or to a search. Landing somewhere that isn't
    // on screen would leave nothing to land on, so widen the view to follow.
    const onScreen = document.querySelector(
      `[data-episode-id="${targetEpisodeId}"]`,
    );
    if (!onScreen) {
      selectCollective("all");
      clearSearch();
    }

    onTrackClick(targetEpisodeId, timestamp);
    tracksPanelActions.land({ episodeId: targetEpisodeId, order: targetOrder });
    // The panel being left behind collapses as this one opens, which moves
    // everything below it. Scrolling on the next frame would aim at where the
    // row used to be, so aim again once the list has settled.
    requestAnimationFrame(() => focusEpisode(targetEpisodeId));
    window.setTimeout(() => focusEpisode(targetEpisodeId), 300);
  };
}

/** The sets on the other side of a record, each at the moment it lands there. */
export function ConnectionTargets({
  connections,
  onHopped,
}: {
  connections: TrackAppearance[];
  onHopped?: () => void;
}) {
  const hopTo = useHopToConnection();

  return (
    <div className="space-y-px">
      {connections.map(({ episode, track }) => (
        <button
          key={episode.id}
          onClick={() => {
            hopTo(episode.id, track.order, track.timestamp);
            onHopped?.();
          }}
          className="flex w-full items-center justify-between rounded px-2 py-2 text-left hover:bg-white/10"
        >
          <div className="min-w-0 pr-3">
            <div className="truncate text-sm font-medium">{episode.name}</div>
            <div className="text-xs text-white/60">
              {formatDate(episode.releasedAt)}
            </div>
          </div>
          {track.timestamp !== undefined && (
            <div className="shrink-0 text-xs tabular-nums text-white/80">
              {formatTimeSecs(track.timestamp)}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * The connections opened underneath their own row. This is the phone's shape —
 * there is nowhere else on a narrow screen to put them.
 */
export function TrackConnectionsInline({
  episodeId,
  order,
  onHopped,
}: {
  episodeId: string;
  order: number;
  onHopped: () => void;
}) {
  const graph = useTrackGraph();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const connections = graph.connectionsFor(episodeId, order);

  // Opened by a landing, these choices can sit below the fold of the panel,
  // which would make carrying on a scroll-then-click. Bring them into view.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      containerRef.current?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  if (connections.length === 0) return null;

  return (
    <div ref={containerRef} className="relative bg-black/25 px-4 py-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
        Also played in {connections.length} other{" "}
        {connections.length === 1 ? "episode" : "episodes"}
      </div>
      <ConnectionTargets connections={connections} onHopped={onHopped} />
    </div>
  );
}
