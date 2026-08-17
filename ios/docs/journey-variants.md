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

## What Track Episodes shows

Rows and the artwork shelf are the same idea twice — a list of destinations,
restyled. A first round tried four ways of showing *more* (a dated spine, a
position bar, the record at size, accent-painted bands); only the position one
landed, and for a reason worth writing down: **what helped was the bigger card
plus a sense of where you'd be once you got there.** Arriving somewhere is
easier to choose than going somewhere. The other three are deleted.

So the round below holds the card fixed and varies only the arrival context.

| Layout | What you'd notice | Reads from |
|---|---|---|
| **Rows** (today) | one row each | baseline |
| **Artwork shelf** | artwork, two across | — |
| **Where it lands** | where the drop falls in the set, named, and the record you'd come out into | `timestamp` ÷ `duration`, next cue |
| **What you land in** | that set's cue sheet around the drop — one before, the record, two after | the cue sheet |
| **Shape of the set** | every track as a mark with the drop lit, so density and entry point read together | every `timestamp` |

The card chrome — artwork, name, date, drop time, the go-now head and the queue
control — lives once in `DestinationCard`; a layout supplies only the middle
panel. That's deliberate: the first round shipped four layouts with **no way to
queue a transition at all**, because each one had to remember to add the
control. Now none of them can forget it.

`LandingPosition` owns the fraction and its wording, so the three can't drift on
what "deep in it" means.

### The countdown on a card

The cards shipped marking an armed destination with a static white outline and
nothing else. Rows drew the wait filling as the record ran out; the cards drew
no countdown at all, which quietly removed the one signal that says how much of
the wait is left — on the layout most likely to win.

`DestinationCard` now reads `ArmedRowStyle` the same way `TrackEpisodeRow` does,
so the three fills apply to both. A fourth option, **Just the outline**, keeps
the cards' original behaviour reachable rather than deleting it unseen.

`armed` is now the whole `QueuedTransition` rather than its style alone, since
the fill needs `progress(at:)` as well as the name of what was picked.

Still true, and the one real gap: a cue sheet with no timestamp gets no bar and
no mark rather than a guessed one, so sparsely-timed sets look emptier in all
three than they do in rows.

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

## A landing belongs on the route — settled

`transitionsFired` appends to the path, so a landed transition grows the route
by a step nobody tapped. This was written up here as a defect, on the argument
that every music app moves what's playing without moving what you're looking at.

Tried in Full screen, with transitions queued one at a time on **blend**: it's
right as it stands. Arranging a transition *is* the navigation — you chose that
set and the moment you'd arrive in it, and the wait is the only thing separating
the choice from the arrival. The route recording it is honest. The music-app
comparison turns out not to apply, because autoplay is a thing that happens to
you and an arranged transition is a thing you did.

Keep the append. No change.

## The real one: a journey restarting from the sheet

Reached in Full screen, deep in a route (624 → 490 → 510 → 473): raise the
episode sheet from the Mini Player, tap a connection in it, and the whole route
collapses to a single step. `JourneyCoordinator.open` assigned
`path = [.track(appearance)]`, which is right only when no journey is running —
and the Mini Player can raise that sheet *over* one.

Fixed by continuing instead: the route is truncated to where that set appears in
it and the new step pushed on, so the rail reads as the sets actually walked. A
set that isn't on the route still starts a fresh journey, which is the old
behaviour and the correct one for that case.

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
