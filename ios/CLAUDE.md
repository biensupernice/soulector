# iOS App — Claude Context

## Project

- **Project file:** `Soulector.xcodeproj`
- **Scheme:** `Soulector`
- **Target:** `Soulector`
- **Bundle ID:** check `Soulector.xcodeproj` if needed

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
ios/Soulector/
├── SoulectorApp.swift          # App entry point
├── AppFont.swift               # Font.app(size:weight:) → Space Grotesk (web parity)
├── Fonts/                      # Space Grotesk TTFs (converted from public/fonts woff2)
├── ContentView.swift           # Root, injects @StateObject stores
├── Views/
│   ├── EpisodesView.swift      # Main list screen; also wires playerStore.onEpisodeEnded + radioStore
│   ├── EpisodeRowView.swift    # List row with context menu
│   ├── EpisodeDetailSheet.swift # Single sheet for browse + playback; contains ProgressSlider, TracklistView
│   ├── MiniPlayerView.swift    # Persistent bottom bar
│   └── PlayerFabs.swift        # Floating radio/shuffle cluster (near-black pill, accent On Air fill)
├── Stores/
│   ├── PlayerStore.swift       # AVPlayer wrapper; publishes accentColor, exposes onEpisodeEnded + userSeeks
│   ├── RadioStore.swift        # Radio mode orchestration (port of web useRadio)
│   └── FavoritesStore.swift    # UserDefaults persistence
├── ViewModels/
│   └── EpisodesViewModel.swift # Episode list + filter state
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
- **Radio mode:** `RadioStore` (wired in `EpisodesView.onAppear` via `configure`) owns tune-in/out, the slot-boundary timer, drift correction, and resume re-sync. `Models/RadioSchedule.swift` computes what's on air and must stay semantically identical to the web's `src/lib/radioSchedule.ts` (same hash, ordering, epoch) — change them together or iOS and web broadcasts diverge

## API

Backend is tRPC at `https://soulector.app/api/trpc`. Key procedures:
- `episodes.all` — all episodes
- `episode.getStreamUrl` — MP3 128kbps stream URL
- `episode.getAccentColor` — RGB accent color from album art
- `episode.getTracks` — track cue sheet
