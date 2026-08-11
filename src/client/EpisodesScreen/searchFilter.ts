import { EpisodeCollectiveSlugProjection } from "@/server/router";

/**
 * Shareable search state, encoded in the URL as a single `?filter=` expression.
 *
 * The expression follows a pragmatic subset of Google AIP-160
 * (https://google.aip.dev/160): a sequence of restrictions implicitly ANDed
 * together by whitespace. Today we understand exactly what the UI can produce:
 *
 *   - a single `collective = <slug>` restriction (the collective selector), and
 *   - free-text terms (the search box).
 *
 * e.g. `collective = soulection missing you` scopes to Soulection and fuzzy
 * searches "missing you". Baking the collective into the link means a shared URL
 * reproduces the exact results the sharer saw, regardless of the recipient's own
 * saved collective.
 *
 * The shape is intentionally small but leaves room to grow into richer AIP-160
 * restrictions later (`track:"..."`, `name:"..."`, `-negation`, date
 * comparisons) without changing the URL contract.
 */
export type SearchFilter = {
  /** Free-text query, matched fuzzily against episode/track names. */
  text: string;
  /**
   * Collective scope. `null` means the filter did not specify one, so the
   * caller should fall back to its existing (persisted) selection.
   */
  collective: SearchFilterCollective | null;
};

export type SearchFilterCollective = "all" | EpisodeCollectiveSlugProjection;

const COLLECTIVE_VALUES: SearchFilterCollective[] = [
  "all",
  "soulection",
  "sasha-marie-radio",
  "the-love-below-hour",
  "local",
];

function isCollective(value: string): value is SearchFilterCollective {
  return (COLLECTIVE_VALUES as string[]).includes(value);
}

// A `collective = <value>` (or `collective:<value>`) restriction anywhere in the
// expression. The value may be bare (`soulection`) or quoted (`"soulection"`).
const COLLECTIVE_RESTRICTION = /collective\s*[:=]\s*(?:"([^"]*)"|(\S+))/i;

/**
 * Parse an AIP-160-subset filter expression into structured search state.
 * Unknown/unsupported syntax is treated as free text so nothing is ever lost.
 */
export function parseFilter(input: string): SearchFilter {
  const filter: SearchFilter = { text: "", collective: null };
  if (!input) return filter;

  let remainder = input;

  const match = remainder.match(COLLECTIVE_RESTRICTION);
  if (match) {
    const rawValue = (match[1] ?? match[2] ?? "").trim().toLowerCase();
    if (isCollective(rawValue)) {
      filter.collective = rawValue;
      // Strip the restriction; whatever is left is the free-text query.
      remainder =
        remainder.slice(0, match.index) +
        remainder.slice((match.index ?? 0) + match[0].length);
    }
  }

  filter.text = remainder.replace(/\s+/g, " ").trim();
  return filter;
}

/**
 * Serialize structured search state back into an AIP-160-subset expression,
 * suitable for a `?filter=` URL param. Returns an empty string when there is
 * nothing to share (no query and no explicit collective), so callers can drop
 * the param entirely and keep the URL clean.
 */
export function serializeFilter(filter: SearchFilter): string {
  const parts: string[] = [];

  if (filter.collective) {
    parts.push(`collective = ${filter.collective}`);
  }

  const text = filter.text.trim();
  if (text) {
    parts.push(text);
  }

  return parts.join(" ");
}
