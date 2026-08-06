import { useEffect } from "react";
import { useSearchIndex } from "./useSearchIndex";
import { buildTrackGraph } from "./useTrackGraph";
import { warmSearchIndexes } from "./useEpisodeSearch";

/**
 * Chew through the derived indexes while the browser has nothing better to do.
 *
 * Both are built from the same snapshot and both are expensive — bucketing the
 * cue sheets into the track graph is ~1.2s on a phone, and tokenising them for
 * search is another ~0.5s. Left alone they land at the worst moment: the graph
 * on the first tap of a set, the search index on the first keystroke. Neither
 * is interruptible, so the point is not to make them cheap but to spend them
 * while the user is still reading the list.
 *
 * One at a time, so the two never fuse into a single two-second block.
 */
export function useWarmIndexes() {
  const index = useSearchIndex();

  useEffect(() => {
    if (!index) {
      return;
    }

    let cancelled = false;
    const jobs = [
      () => buildTrackGraph(index),
      () => warmSearchIndexes(index),
    ];

    function next() {
      if (cancelled) return;
      const job = jobs.shift();
      if (!job) return;
      job();
      whenIdle(next);
    }

    let handle = 0;

    function whenIdle(run: () => void) {
      // requestIdleCallback only landed in Safari 16; a short delay is close
      // enough on anything older.
      handle = window.requestIdleCallback
        ? window.requestIdleCallback(run, { timeout: 4000 })
        : window.setTimeout(run, 500);
    }

    whenIdle(next);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(handle);
      }
      window.clearTimeout(handle);
    };
  }, [index]);
}
