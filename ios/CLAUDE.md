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
├── ContentView.swift           # Root, injects @StateObject stores
├── Views/
│   ├── EpisodesView.swift      # Main list screen; also wires playerStore.onEpisodeEnded
│   ├── EpisodeRowView.swift    # List row with context menu
│   ├── EpisodeDetailSheet.swift # Single sheet for browse + playback; contains ProgressSlider, TracklistView
│   └── MiniPlayerView.swift    # Persistent bottom bar
├── Stores/
│   ├── PlayerStore.swift       # AVPlayer wrapper; publishes accentColor, exposes onEpisodeEnded
│   └── FavoritesStore.swift    # UserDefaults persistence
├── ViewModels/
│   └── EpisodesViewModel.swift # Episode list + filter state
├── Models/
│   ├── Episode.swift
│   └── EpisodeTrack.swift
└── Networking/
    └── APIClient.swift         # tRPC over HTTPS; singleton
```

## Key patterns

- **State:** `@StateObject` in `ContentView`, passed down as `@EnvironmentObject`
- **Accent color:** `PlayerStore.accentColor` (Color) — fetched from `episode.getAccentColor` API when an episode plays; also fetched locally in `EpisodeDetailSheet` for the viewed episode
- **Auto-advance:** `PlayerStore.onEpisodeEnded` closure — wired in `EpisodesView.onAppear`
- **Single sheet:** Mini player tap and episode row tap both set `selectedEpisode`; `EpisodeDetailSheet` handles both browse and active playback
- **Haptics:** `UIImpactFeedbackGenerator` (no iOS 17 requirement)

## API

Backend is tRPC at `https://soulector.app/api/trpc`. Key procedures:
- `episodes.all` — all episodes
- `episode.getStreamUrl` — MP3 128kbps stream URL
- `episode.getAccentColor` — RGB accent color from album art
- `episode.getTracks` — track cue sheet
