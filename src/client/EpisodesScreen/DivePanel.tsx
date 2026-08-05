import { useEffect, useState } from "react";
import { EpisodeTracksList } from "./EpisodeModalSheet";
import { TrackBranchBadge } from "./TrackBranchBadge";
import { ConnectionTargets } from "./TrackConnections";
import { useTrackGraph } from "./useTrackGraph";
import { useEpisodeTracks } from "./EpisodeModalSheet";
import { useTracksPanelStore } from "./TracksPanelStore";

/**
 * The desktop shape of a dive: the set's cue sheet on the left, where any of
 * its records can take you on the right.
 *
 * The panel stays put and the archive moves through it. Aiming at a record
 * costs nothing — the right column fills without playing anything — so you can
 * look before you leap, which a phone pushing screens onto a stack cannot do.
 */
export function DivePanel({ episodeId }: { episodeId: string }) {
  const graph = useTrackGraph();
  const { data, loaded } = useEpisodeTracks(episodeId);
  const landedOn = useTracksPanelStore((s) => s.landedOn);

  // The record whose connections the right column is showing.
  const [pivot, setPivot] = useState<number | null>(null);

  // Arriving by a crossing aims at the record that carried you in.
  useEffect(() => {
    if (landedOn?.episodeId === episodeId) {
      setPivot(landedOn.order);
    }
  }, [landedOn, episodeId]);

  const tracks = loaded ? (data ?? []) : [];
  const pivotTrack = tracks.find((t) => t.order === pivot);
  const connections =
    pivot === null ? [] : graph.connectionsFor(episodeId, pivot);

  return (
    <div className="grid h-[min(60vh,32rem)] w-full grid-cols-[1fr_17rem] lg:grid-cols-[1fr_20rem]">
      <div className="min-h-0 overflow-y-auto">
        <EpisodeTracksList
          episodeId={episodeId}
          rowAccessory={(track) => (
            <TrackBranchBadge
              count={graph.connectionCountFor(episodeId, track.order)}
              active={pivot === track.order}
              onClick={() =>
                setPivot((current) =>
                  current === track.order ? null : track.order,
                )
              }
            />
          )}
        />
      </div>

      <div className="min-h-0 overflow-y-auto border-l border-white/10 bg-black/20 text-white">
        {pivotTrack ? (
          <div className="p-4">
            <div className="mb-1 text-sm font-bold leading-tight text-white">
              {pivotTrack.name}
            </div>
            <div className="mb-4 text-xs text-white/70">
              {pivotTrack.artist}
            </div>
            {connections.length > 0 ? (
              <>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Also played in {connections.length} other{" "}
                  {connections.length === 1 ? "set" : "sets"}
                </div>
                <ConnectionTargets connections={connections} />
              </>
            ) : (
              <div className="text-xs text-white/50">
                This one stays here — no other set played it.
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs leading-relaxed text-white/40">
            Pick a record&rsquo;s branch to see the other sets that played it.
          </div>
        )}
      </div>
    </div>
  );
}
