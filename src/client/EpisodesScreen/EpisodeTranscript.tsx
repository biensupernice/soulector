import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { formatTimeSecs } from "../helpers";
import { usePlayerActions, usePlayerProgress } from "./PlayerStore";
import { getScrollParent } from "./scrollParent";

/**
 * Reading along with an episode.
 *
 * These are two-hour DJ sets, and what gets said between the records — who is
 * guesting, where a record came from, what it is called — has until now only
 * existed as audio. The transcript makes it text you can read, scroll back
 * through, and tap to jump to.
 *
 * Machine-made and then reviewed by hand before publishing, which is why a
 * transcript exists for some episodes and not others: nothing appears here
 * until someone has passed it.
 */

/**
 * Which episodes have a transcript at all.
 *
 * One list of ids for the whole catalogue, so a row can show the badge without
 * a request of its own. Held for the session — publishing happens in batches,
 * by hand, and a new one appearing three seconds sooner is worth nothing
 * against a request per episode.
 */
export function useTranscriptAvailability() {
  const { data } = trpc["transcripts.available"].useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return useMemo(() => new Set(data ?? []), [data]);
}

export function useHasTranscript(episodeId: string) {
  return useTranscriptAvailability().has(episodeId);
}

export function useEpisodeTranscript(episodeId: string, enabled = true) {
  const { data, status } = trpc["episode.getTranscript"].useQuery(
    { episodeId },
    {
      enabled,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  );

  return {
    data,
    loaded: status === "success",
    hasTranscript: status === "success" && !!data && data.segments.length > 0,
  };
}

/**
 * Search every published transcript for a phrase.
 *
 * Unlike the episode and tracklist search, this one is a request. The episode
 * index is a couple of megabytes and lives in the browser; the transcripts are
 * a hundred times that and always will, so the searching happens where they
 * are. Which makes the debounce load-bearing rather than a nicety.
 */
const TRANSCRIPT_SEARCH_DEBOUNCE_MS = 300;
const MIN_TRANSCRIPT_QUERY = 3;

export function useTranscriptSearch(query: string) {
  const trimmed = query.trim();
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(trimmed), TRANSCRIPT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [trimmed]);

  const enabled = debounced.length >= MIN_TRANSCRIPT_QUERY;
  const { data, isFetching } = trpc["transcripts.search"].useQuery(
    { q: debounced },
    {
      enabled,
      staleTime: 5 * 60 * 1000,
      // Keep the previous hits on screen while the next query lands, so
      // typing does not empty the list between keystrokes.
      placeholderData: (previous) => previous,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  );

  return {
    hits: enabled ? (data ?? []) : [],
    // Only while there is nothing to show — a spinner over stale results that
    // are about to be replaced by near-identical ones just flickers.
    loading: enabled && isFetching && !data,
  };
}

/**
 * The transcript, following the playhead.
 *
 * Binary search rather than a scan: a two-hour episode is a few thousand
 * lines and this re-runs on every progress tick, several times a second.
 */
function currentLineIndex(segments: { start: number }[], atSecs: number) {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start <= atSecs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function EpisodeTranscriptList({ episodeId }: { episodeId: string }) {
  const progress = usePlayerProgress();
  const playerActions = usePlayerActions();
  const { data, loaded } = useEpisodeTranscript(episodeId);

  const segments = loaded && data ? data.segments : [];
  const currentIndex = useMemo(
    () => currentLineIndex(segments, progress / 1000),
    [segments, progress],
  );

  const currentRef = useRef<HTMLButtonElement | null>(null);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (currentIndex < 0) return;

    const el = currentRef.current;
    if (!el) return;
    const container = getScrollParent(el);
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Already in view: leave the scroll alone. Lines change every few seconds,
    // and yanking the page on each one would make it unreadable.
    if (elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom) {
      return;
    }
    const delta =
      elRect.top - containerRect.top - (container.clientHeight - elRect.height) / 2;
    const isFirst = !hasCenteredRef.current;
    hasCenteredRef.current = true;
    container.scrollTo({
      top: container.scrollTop + delta,
      behavior: isFirst ? "auto" : "smooth",
    });
  }, [currentIndex]);

  if (!loaded) {
    return (
      <div className="px-4 py-6 text-sm text-white/60">Loading transcript…</div>
    );
  }
  if (segments.length === 0) return null;

  return (
    <div className="relative w-full py-4 text-white">
      <div className="mb-4 flex items-baseline justify-between px-4">
        <div className="text-lg font-bold">Transcript</div>
        <div className="text-xs text-white/60">
          {segments.length} lines
          {data && data.langs.length > 1
            ? ` · ${data.langs.slice(0, 3).join(", ")}`
            : ""}
        </div>
      </div>

      <div className="px-1">
        {segments.map((segment, i) => {
          const isCurrent = i === currentIndex;
          return (
            <button
              key={`${segment.start}-${i}`}
              ref={isCurrent ? currentRef : undefined}
              onClick={() => playerActions.setCuePosition(segment.start * 1000)}
              className={cn(
                "flex w-full items-start gap-3 rounded-md px-3 py-1.5 text-left",
                "hover:bg-white/10 focus:outline-none",
              )}
              title={`Play from ${formatTimeSecs(segment.start)}`}
            >
              <span
                className={cn(
                  "w-11 shrink-0 pt-0.5 text-right text-[11px] tabular-nums",
                  isCurrent ? "text-white" : "text-white/40",
                )}
              >
                {formatTimeSecs(segment.start)}
              </span>
              <span
                className={cn(
                  "min-w-0 text-sm",
                  isCurrent ? "font-semibold text-white" : "text-white/70",
                )}
              >
                {segment.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Said plainly, because a transcript that reads oddly should look like
          a machine's work rather than something the show got wrong. */}
      <p className="mt-4 px-4 text-[11px] leading-relaxed text-white/40">
        Transcribed automatically and checked by hand. Lyrics and names may
        still be wrong.
      </p>
    </div>
  );
}
