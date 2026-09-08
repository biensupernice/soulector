/**
 * The nearest ancestor that actually scrolls.
 *
 * Both the tracklist and the transcript keep the currently-playing row in
 * view, and neither owns its own scroller — the sheet and the desktop panel
 * put them in different containers. Walking up to find the real one is what
 * lets the same centring code work in both.
 */
export function getScrollParent(el: HTMLElement): HTMLElement | null {
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
