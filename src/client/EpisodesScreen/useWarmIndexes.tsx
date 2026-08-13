import { useEffect } from "react";
import { useSearchIndex } from "./useSearchIndex";
import { warmSearchIndexes } from "./useEpisodeSearch";

/**
 * Tokenise the library for search while the browser has nothing better to do.
 *
 * Indexing 785 titles and ~20k cue-sheet rows is about half a second on a
 * phone, and it is not interruptible. Left alone it lands on the first
 * keystroke, which is the worst moment to spend it; the point is not to make
 * it cheap but to spend it while the user is still reading the list.
 */
export function useWarmIndexes() {
  const index = useSearchIndex();

  useEffect(() => {
    if (!index) {
      return;
    }

    let cancelled = false;

    function warm() {
      if (!cancelled && index) {
        warmSearchIndexes(index);
      }
    }

    // requestIdleCallback only landed in Safari 16; a short delay is close
    // enough on anything older.
    const handle = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 4000 })
      : window.setTimeout(warm, 500);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(handle);
      }
      window.clearTimeout(handle);
    };
  }, [index]);
}
