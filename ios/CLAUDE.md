# iOS App — Claude Context

## Project

- **Project file:** `Soulector.xcodeproj`
- **Scheme:** `Soulector`
- **Targets:** `Soulector` (app), `SoulectorWidget` (WidgetKit extension)
- **Bundle IDs:** app `com.soulector.app`, widget `com.soulector.app.widget`
- **App Group:** `group.com.soulector.app` — shared container for the widget's
  now-playing snapshot + artwork. Enabled via `Soulector/Soulector.entitlements`
  and `SoulectorWidget/SoulectorWidget.entitlements`; the capability must be
  toggled on in signing (Automatic signing provisions it).

## Building

```bash
# Build for simulator
xcodebuild -project ios/Soulector.xcodeproj -scheme Soulector -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# Build only (no run)
xcodebuild -project ios/Soulector.xcodeproj -scheme Soulector -configuration Debug build
```

Via Xcode MCP (preferred when available):
- Use the `xcode` MCP server tools to build and get structured diagnostics

## Architecture

SwiftUI app, iOS 16+, no third-party dependencies.

```
ios/Shared/                     # Compiled into BOTH app + widget targets
├── NowPlaying.swift            # NowPlayingSnapshot + NowPlayingStore (App Group I/O)
└── SoulectorLink.swift         # soulector:// deep-link actions (tune-in/shuffle/toggle)

ios/SoulectorWidget/            # Home-screen widget extension
├── SoulectorWidgetBundle.swift # @main WidgetBundle
├── NowPlayingWidget.swift      # Now Playing card (small + medium), accent-tinted
├── Info.plist                  # NSExtension (widgetkit) + Space Grotesk UIAppFonts
└── SoulectorWidget.entitlements # App Group

ios/Soulector/
├── SoulectorApp.swift          # App entry point
├── AppFont.swift               # Font.app(size:weight:) → Space Grotesk (web parity)
├── Fonts/                      # Space Grotesk TTFs (converted from public/fonts woff2)
├── ContentView.swift           # Root, injects @StateObject stores
├── Views/
│   ├── EpisodesView.swift      # Main list screen; also wires playerStore.onEpisodeEnded + radioStore
│   ├── EpisodeRowView.swift    # List row with kebab control and long-press menu
│   ├── EpisodeActions.swift    # Kebab button, long-press menu contents, download status badge/ring
│   ├── EpisodeActionsSheet.swift # The kebab's destination: accent-painted action panel
│   ├── EpisodeArtwork.swift    # Album art; prefers the downloaded copy over the network
│   ├── EpisodeDetailSheet.swift # Single sheet for browse + playback; contains ProgressSlider, TracklistView
│   ├── TrackDiveSheet.swift    # Sideways navigation: a track → the other sets that played it → on again
│   ├── MiniPlayerView.swift    # Persistent bottom bar
│   └── PlayerFabs.swift        # Floating radio/shuffle cluster (near-black pill, accent On Air fill)
├── Stores/
│   ├── PlayerStore.swift       # AVPlayer wrapper; publishes accentColor, exposes onEpisodeEnded + userSeeks
│   ├── RadioStore.swift        # Radio mode orchestration (port of web useRadio)
│   ├── DownloadsStore.swift    # Offline downloads (background URLSession); singleton
│   ├── NetworkMonitor.swift    # NWPathMonitor connectivity
│   └── FavoritesStore.swift    # UserDefaults persistence
├── ViewModels/
│   ├── EpisodesViewModel.swift # Episode list + filter state + search index/track graph
│   ├── EpisodeSearch.swift     # Client-side episode/track search over the index
│   └── TrackConnections.swift  # TrackGraph + TrackIdentity — the same-record index
├── Models/
│   ├── Episode.swift
│   ├── EpisodeTrack.swift
│   └── RadioSchedule.swift     # Deterministic broadcast schedule — MUST match src/lib/radioSchedule.ts
└── Networking/
    └── APIClient.swift         # tRPC over HTTPS; singleton
```

## Key patterns

- **State:** `@StateObject` in `ContentView`, passed down as `@EnvironmentObject`
- **Accent color:** `PlayerStore.accent` (AccentColor) — fetched from `episode.getAccentColor` when an episode plays; also fetched locally in `EpisodeDetailSheet` for the viewed episode. The web extracts a dark-leaning swatch (DarkVibrant) chosen to sit on light surfaces; this app mirrors that with surface-aware variants: `raw` (episode sheet background, like the web's `bg-accent`), `accentOnLight` (dark-leaning; the FAB cluster's On Air fill), `accentOnDark` (lightness lifted for elements on black — mini player controls, playing row title). The API also returns the full extraction `palette`; this app resolves to the **Vibrant** swatch (`AccentColor.appSwatch`) — richer on the dark UI than the web's DarkVibrant default — falling back to the server's pick when palette data is absent
- **Auto-advance:** `PlayerStore.onEpisodeEnded` closure — wired in `EpisodesView.onAppear`
- **Single sheet:** Mini player tap and episode row tap both set `selectedEpisode`; `EpisodeDetailSheet` handles both browse and active playback
- **Haptics:** `UIImpactFeedbackGenerator` (no iOS 17 requirement)
- **Typography:** Space Grotesk everywhere via `Font.app(size:weight:)` (plus a root `.environment(\.font, ...)` default). SF Symbols keep `.system` fonts — symbols don't render in custom fonts
- **Offline downloads:** `DownloadsStore` is a **singleton**, not a `@StateObject` — iOS relaunches the app to hand back finished background transfers (`SoulectorApp.backgroundTask(.urlSession:)`), which needs the session rebuilt from outside the view tree. Files live in `Application Support/Downloads` (excluded from backup), described by a `manifest.json` that also stores the `Episode` itself, since the episodes list lives in the evictable caches directory. Each download captures **sidecars** — artwork, tracklist, accent — so a downloaded episode looks and reads the same with no network; `PlayerStore` prefers the local audio/artwork/metadata, and `EpisodeArtwork` prefers the local image. Entry point is the kebab (`EpisodeKebabButton`), which opens `EpisodeActionsSheet` — a self-sizing sheet painted in that episode's album accent, holding download/favorite/SoundCloud. It stays open through an action so state changes are visible in place. **Presentation is owned by the screen** (`EpisodesView.actionsEpisode`), not the row — a sheet attached to a list row dies when the row recycles — and the two `.sheet` modifiers are attached to *different* views, since two on one view fight. Long-press still gets the native menu (`EpisodeActions`). State shows as a `DownloadBadge` in the metadata line, alongside a heart mark when favorited (favoriting is an action, not a row control). Offline (`NetworkMonitor`), non-downloaded rows dim and stop responding, the radio FAB disables, shuffle draws from downloads, and the list count reads "Offline · N downloaded"
- **Sideways track navigation:** every tracklist row that another set also
  played carries a branch badge (`TrackBranchButton`, count included); tapping
  it opens `TrackDiveSheet`, whose `NavigationStack` *is* the dive — a track
  screen lists the other episodes that played it (with the timestamp it lands
  at), tapping one plays it there **and** pushes that episode's tracklist, from
  which you can branch again. Back retraces the path. Everything is local:
  `TrackGraph` (`ViewModels/TrackConnections.swift`) buckets every cue sheet in
  the `episodes.searchIndex` snapshot by `TrackIdentity.key`, so the index is no
  longer just for search and is fetched at launch (`EpisodesView.task`), and the
  graph is rebuilt off the main actor whenever it changes.
  `TrackIdentity` is deliberately exact, not fuzzy — a wrong connection is worse
  than a missing one. It folds case/diacritics, normalizes `&`, drops guest
  credits (bracketed *and* bare `feat.`), keeps remix parentheticals, cuts an
  artist credit at its first name, and refuses to key placeholders ("ID",
  "Intro") or station idents ("Soulection Radio — Hosted by Joe Kay", 252 rows
  in the live library and the one cluster that would swamp everything). Against
  the live index that keys 97% of ~20.6k tracks and gives 42% of them somewhere
  to go. A dive that leaves a different episode playing reports back through
  `EpisodeDetailSheet.onNavigate` so the sheet underneath retargets to where the
  user landed rather than describing the set they left
- **Radio mode:** `RadioStore` (wired in `EpisodesView.onAppear` via `configure`) owns tune-in/out, the slot-boundary timer, drift correction, and resume re-sync. `Models/RadioSchedule.swift` computes what's on air and must stay semantically identical to the web's `src/lib/radioSchedule.ts` (same hash, ordering, epoch) — change them together or iOS and web broadcasts diverge
- **Home-screen widget:** `SoulectorWidget` shows the current mix on an
  album-accent-tinted card (Spotify-widget style — `Color.soulectorCard` clamps
  the extracted `accentHSL` into a mid-dark band). `PlayerStore.publishNowPlaying()`
  writes a `NowPlayingSnapshot` (title, collective, isPlaying, elapsed/duration,
  radio state, accent) + downsampled artwork to the App Group on every playback
  change and calls `WidgetCenter.reloadAllTimelines()`; `RadioStore` mirrors
  on-air via `PlayerStore.setRadioOn`. The widget can't drive `AVPlayer`, so its
  buttons are `soulector://` deep links (`SoulectorAction`) opened into the app
  and dispatched by `EpisodesView.onOpenURL`: **medium** = play/pause + Tune In
  + Shuffle (mirrors the FAB), **small** = the card with a single Tune In tap
  target
- **Widget, two things worth knowing before changing it:**
  - *Never reload the timeline to tick the clock.* WidgetKit's daily reload
    budget can't absorb it. The snapshot carries `elapsedSeconds` +
    `durationSeconds` (not a baked fraction) so `NowPlayingProvider` emits
    future entries via `NowPlayingSnapshot.advanced(by:)` and the progress line
    moves on its own. Reloads are for discrete events only
  - *The widget must survive having no App Group.* When the shared container
    isn't readable (signing without the capability, or nothing played yet),
    `LiveRadioPreview` computes what's on the air from `RadioSchedule` + the
    public API — no shared state needed — and the card is labelled "ON AIR NOW"
    so it never reads as this device's playback

## API

Backend is tRPC at `https://soulector.app/api/trpc`. Key procedures:
- `episodes.all` — all episodes
- `episode.getStreamUrl` — MP3 128kbps stream URL
- `episode.getAccentColor` — RGB accent color from album art
- `episode.getTracks` — track cue sheet
