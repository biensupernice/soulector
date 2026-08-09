# Journey language

The vocabulary for sideways navigation, so variants can be argued about in the
abstract instead of by pointing at screens.

It extends the app's existing UI nouns rather than replacing them. **Episodes,
Episode Tracks, Collectives, Track List** already name most of this; the rule is
*never rename something the UI already names*, and derive new names by
compounding the old ones.

## The material

| Term | Is | Code |
|---|---|---|
| **Episode** | one show | `Episode` |
| **Track** | one row of a cue sheet | `EpisodeTrack` |
| **Record** | the musical work, folded across episodes | `TrackIdentity.key` |
| **Track Appearance** | one record played in one episode at one timestamp | `TrackAppearance` |
| **Connection** | two episodes joined by a shared record | `TrackGraph.connectionCount` |
| **Transition** | an audio handoff between episodes over a shared record | `QueuedTransition` |

A record is not an appearance. The whole feature exists because one record has
many appearances.

## The two screens, and the law

The graph is bipartite, so a journey alternates. Two screens, exact inversions
of each other, never two of a kind in a row:

- **Track Episodes** — one track, every episode that played it. Offers the exits.
  (`TrackEpisodesScreen`)
- **Episode Tracks** — one episode, its whole **Track List**, with you placed
  inside it. Offers the next exit. (`EpisodeTracksScreen`)

> **Episode Tracks → Track Episodes → Episode Tracks → …**

That alternation is the law every navigation variant must preserve. One
consequence worth taking seriously: *Track Episodes may not need to be a screen
at all.* It's a transient choice among 3–4 rows, so a tray or a popover could
serve it. Episode Tracks genuinely needs a surface. If a variant collapses one
of them, collapse Track Episodes.

## The two threads

A journey moves two things, and they come apart:

- **Viewed Episode** — what's on screen
- **Current Episode** — what's playing (`playerStore.currentEpisode`)

| Move | Viewed | Current |
|---|---|---|
| open a track's connections | moves | stays |
| play an appearance | moves | moves |
| queue a transition | stays | moves *later* |
| a transition fires | dragged along | moves |
| Back | moves | stays |
| Done | leaves | stays |

Nearly every hard question here is *"what do we show while the viewed episode
and the current episode are different?"* — `onNavigate`, `transitionsFired`, the
handover crossfade and the landing focus are all answers to that one question.
Navigation variants are mostly competing proposals about rendering that gap.

**Path** is the route behind you (`[JourneyStep]` — viewed-only; playback never
retraces). The **Mini Player** is the one surface that always says what the
current episode is.

## What the language exposes

Applied to the current build: **during a journey there is no Mini Player.** The
journey sheet covers it, so at the moment the viewed and current episodes are
most likely to differ, the readout of what's playing is gone — which is why
Episode Tracks had to grow its own Pause button. Any variant that keeps the Mini
Player visible gets that back for free.

## The axes variants differ on

1. Where the **path** lives — modal over the episode sheet (today), the app's own
   navigation stack, a dedicated screen, or expanded inline
2. Whether **Track Episodes** is a screen or a tray
3. What happens to the path when the **current episode** moves on its own
   (today: the viewed episode is yanked to the landing)
4. How you get from N steps deep back to just listening (today: one tap, path
   discarded)
5. Whether the **Mini Player** survives the journey
