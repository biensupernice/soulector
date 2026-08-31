import type { EpisodeCollectiveSlugProjection } from "@/server/router";

/**
 * Collectives the app no longer surfaces.
 *
 * The Love Below Hour published 134 episodes to SoundCloud between 2016 and
 * 2024. In 2026 the account was emptied — one track remains, and the other 133
 * return nothing. Soulector went on listing them, so a third of a collective's
 * worth of episodes sat in the app looking playable and doing nothing when
 * tapped. Hiding is the honest state: the episodes are unreachable, not merely
 * out of favour.
 *
 * Nothing is deleted. The rows, their tracklists and their timestamps stay in
 * the database, and the audio that could be salvaged is archived offline. If
 * the collective ever reposts, taking the slug out of this list is the whole
 * of the work needed to bring it back.
 *
 * Syncing deliberately continues to run against the collective, so that a
 * return would be noticed rather than having to be guessed at.
 */
export const HIDDEN_COLLECTIVES = ["the-love-below-hour"] as const;

export type HiddenCollective = (typeof HIDDEN_COLLECTIVES)[number];

export function isHiddenCollective(slug: string | null | undefined): boolean {
  return (
    !!slug && (HIDDEN_COLLECTIVES as readonly string[]).includes(slug)
  );
}

/**
 * A collective selection that is safe to show. Anyone whose last visit left
 * "the-love-below-hour" in local storage would otherwise return to a screen
 * that is permanently, inexplicably empty.
 */
export function usableCollective(
  slug: string | null | undefined,
): "all" | EpisodeCollectiveSlugProjection {
  if (!slug || isHiddenCollective(slug)) return "soulection";
  return slug as "all" | EpisodeCollectiveSlugProjection;
}
