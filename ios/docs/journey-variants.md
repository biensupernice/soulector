# Journey variants under trial

Written in the terms from `journey-language.md`. Nothing here is settled — this
is the roster, with where each idea came from, so a variant can be argued about
before it's built and dropped without ceremony after.

Two kinds of thing, which is the point of splitting the list:

- **Containers** — where a journey lives. Mutually exclusive; one is running at
  any moment (`JourneyNavigation`).
- **Layers** — what a journey shows about itself. Orthogonal and combinable;
  any layer can ride along with any container (`JourneyLayers`).

## Containers

| Variant | What you'd notice | Precedent | Probes |
|---|---|---|---|
| **Sheet over sheet** (today) | The journey opens on top of the episode | — | baseline |
| **Push in the sheet** | The episode sheet carries you along; one modal, never two | ordinary iOS push, inside a sheet | 1 |
| **Peek** | Track Episodes arrives as a short sheet you can flick away; picking one retargets the episode sheet in place | Wikipedia page previews; Serato "Show in Crates"; rekordbox Related Tracks panel; VS Code Peek Definition | 2, 4, 5 |
| **Open in the list** | Connections unfold under the track row, no new surface at all | Roam/Obsidian linked mentions; Are.na "connected to N channels" | 1, 2, 4 |
| **Full screen** | The journey pushes over the Episodes list and the Mini Player stays with you the whole way | Apple Music credits, Tidal credits, SoundCloud "appears on"; Maps place card over a map it never hides | 1, 3, 5 |
| **Sideways pages** | Swipe right to go back, **left to go forward again** | Miller columns; Obsidian sliding panes; YouTube Music's panel tabs | 1, 4 |

Two structural facts constrain this table, both worth stating once:

- **A sheet cannot show the Mini Player.** Sheets are bottom-anchored at every
  detent — a shorter detent opens a gap at the *top*. So "keep the player bar"
  and "leave the modals" are one decision, not two, and only **Full screen**
  can deliver it. The alternative is rendering a second Mini Player inside the
  journey, which is a copy rather than the bar surviving.
- **Peek and Open-in-the-list have no route**, so they owe an answer to "how do
  I get back" that the stack variants get for free.

## Layers

| Layer | What it adds | Precedent |
|---|---|---|
| **Route rail** | The path as album-art chips; tap one to jump back to that step | Finder path bar; VS Code breadcrumbs; Safari's long-press-back history |
| **Now-playing strip** | Names both threads — viewing vs playing — with a Return that appears only when they differ | Spotify's go-to-current; Apple Music's tap-the-bar-to-return |

Today's path is write-only: no labels, no jumping, no forward, and Done
discards it entirely. Both layers exist to test whether that's the actual
complaint, independently of which container wins.

## Not modelled yet

Bigger ideas, recorded so they aren't lost:

- **The reel** — the path as a filmstrip of album art across the top; the
  playing episode's card lit, the viewed one outlined, so the viewed/current gap
  renders as literal distance between two marks. A fired transition slides a new
  card in without moving what you're looking at.
- **Route map** — a full-screen picture of where you've been, branches
  preserved when you back up and go somewhere else. Needs a tree rather than
  `[JourneyStep]`.

Both want real design time, and neither is worth building before the containers
have told us what the actual problem is.

## One defect, independent of all of it

`transitionsFired` appends to the path, so when a queued transition lands the
route grows a step the user never walked and Back retraces a trip they didn't
take. Every music app does the opposite — autoplay moves what's playing and
never moves what you're looking at — and VS Code keeps tool-driven navigation in
a separate history from user-driven for exactly this reason. Worth fixing on its
own, whatever wins.

## Removing all of this

The exploration is meant to be deleted, so it's kept findable. Everything added
for it is either in a dedicated file or carries a `[journey-variants]` marker:

```bash
grep -rn "journey-variants" ios/
```

**Delete outright:**

- `ios/Soulector/Views/JourneyVariants.swift` — every variant-only view
  (`PeekConnections`, `InlineConnections`, `JourneyPager`, `RouteRail`,
  `NowPlayingStrip`, `JourneyDestinations`)
- `ios/Soulector/Views/JourneyNavigation.swift` — the enum, the layers, the
  environment values, the picker
- both of their `project.pbxproj` entries (four lines each)
- this file

**Unpick, guided by the markers:**

| File | What's there |
|---|---|
| `ContentView.swift` | the two `@AppStorage` reads and the two environment modifiers |
| `EpisodeDetailSheet.swift` | `journeyStackIfNeeded`, the peek branch in the journey sheet, the inline parameters on `TracklistView`, the full-screen handoff in the connections tap |
| `EpisodesView.swift` | `rootStackIfNeeded`, the `onDismiss` handoff, the coordinator/environment properties |
| `TrackJourneySheet.swift` | the pager branch, the layer insets in `JourneyChrome`, its three optional parameters |
| `EpisodeActionsSheet.swift` | one `JourneyNavigationPicker()` row |

`JourneyCoordinator` is the one piece worth keeping whichever variant wins — a
journey having a single home is right regardless — but it lives in
`JourneyNavigation.swift` today and should move before that file goes.
