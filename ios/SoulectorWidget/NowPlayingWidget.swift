import SwiftUI
import UIKit
import WidgetKit

// MARK: - Widget

struct NowPlayingWidget: Widget {
    private let kind = "SoulectorNowPlaying"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NowPlayingProvider()) { entry in
            NowPlayingWidgetView(entry: entry)
        }
        .configurationDisplayName("Now Playing")
        .description("Your current mix, live radio, and shuffle — one tap away.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Timeline

struct NowPlayingEntry: TimelineEntry {
    let date: Date
    let snapshot: NowPlayingSnapshot
    let artwork: Image?
}

struct NowPlayingProvider: TimelineProvider {
    func placeholder(in context: Context) -> NowPlayingEntry {
        NowPlayingEntry(date: Date(), snapshot: .preview, artwork: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (NowPlayingEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NowPlayingEntry>) -> Void) {
        // The app calls WidgetCenter.reloadAllTimelines() on every playback
        // change; this periodic refresh is just a backstop to keep the
        // progress line from going stale while the app is backgrounded.
        let entry = currentEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 2, to: Date())
            ?? Date().addingTimeInterval(120)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func currentEntry() -> NowPlayingEntry {
        let snapshot = NowPlayingStore.load()
        var artwork: Image?
        if let data = NowPlayingStore.loadArtworkData(), let ui = UIImage(data: data) {
            artwork = Image(uiImage: ui)
        }
        return NowPlayingEntry(date: Date(), snapshot: snapshot, artwork: artwork)
    }
}

// MARK: - Root view

struct NowPlayingWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: NowPlayingEntry

    private var snapshot: NowPlayingSnapshot { entry.snapshot }
    private var cardColor: Color { .soulectorCard(hsl: snapshot.accentHSL) }

    var body: some View {
        content
            .widgetBackground(cardColor)
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemSmall:
            SmallNowPlaying(entry: entry)
        default:
            MediumNowPlaying(entry: entry)
        }
    }
}

// MARK: - Small

/// One tap target only (WidgetKit limits `systemSmall` to `widgetURL`), so the
/// card shows the current mix and the whole tile tunes in to live radio — the
/// guaranteed action.
private struct SmallNowPlaying: View {
    let entry: NowPlayingEntry
    private var s: NowPlayingSnapshot { entry.snapshot }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                BrandMark()
                Spacer()
                RadioBadge(on: s.isRadioOn)
            }

            Spacer(minLength: 0)

            if s.hasEpisode {
                Artwork(image: entry.artwork, size: 44)
                Text(s.title)
                    .font(.app(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(2)
                Text(s.subtitle)
                    .font(.app(size: 12))
                    .foregroundColor(.white.opacity(0.7))
                    .lineLimit(1)
            } else {
                Text("Tune in to\nlive radio")
                    .font(.app(size: 17, weight: .bold))
                    .foregroundColor(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ProgressLine(progress: s.hasEpisode ? s.progress : 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(SoulectorAction.tuneIn.url)
    }
}

// MARK: - Medium

/// The full card: current mix + play/pause up top, and the two FAB actions —
/// Tune In and Shuffle — along the bottom. Background taps open now playing.
private struct MediumNowPlaying: View {
    let entry: NowPlayingEntry
    private var s: NowPlayingSnapshot { entry.snapshot }

    var body: some View {
        VStack(spacing: 12) {
            if s.hasEpisode {
                nowPlayingRow
                ProgressLine(progress: s.progress)
            } else {
                emptyRow
            }
            actionRow
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(SoulectorAction.openNowPlaying.url)
    }

    private var nowPlayingRow: some View {
        HStack(spacing: 12) {
            Artwork(image: entry.artwork, size: 52)

            VStack(alignment: .leading, spacing: 2) {
                Text(s.title)
                    .font(.app(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text(s.subtitle)
                    .font(.app(size: 13))
                    .foregroundColor(.white.opacity(0.7))
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            Link(destination: SoulectorAction.togglePlayPause.url) {
                ZStack {
                    Circle().fill(Color.white)
                    Image(systemName: s.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.black)
                }
                .frame(width: 44, height: 44)
            }
        }
    }

    private var emptyRow: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.15))
                Image(systemName: "dot.radiowaves.left.and.right")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(.white)
            }
            .frame(width: 52, height: 52)

            VStack(alignment: .leading, spacing: 2) {
                Text("Soulector")
                    .font(.app(size: 16, weight: .bold))
                    .foregroundColor(.white)
                Text("Nothing playing — tune in below")
                    .font(.app(size: 13))
                    .foregroundColor(.white.opacity(0.7))
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }

    private var actionRow: some View {
        HStack(spacing: 8) {
            Link(destination: SoulectorAction.tuneIn.url) {
                ActionPill(
                    systemImage: s.isRadioOn ? nil : "dot.radiowaves.left.and.right",
                    title: s.isRadioOn ? "On Air" : "Tune In",
                    prominent: true,
                    leadingDot: s.isRadioOn
                )
            }

            Link(destination: SoulectorAction.shuffle.url) {
                ActionPill(systemImage: "shuffle", title: "Shuffle", prominent: false)
            }
        }
    }
}

// MARK: - Building blocks

/// The album art, or a music-note placeholder before artwork is cached.
private struct Artwork: View {
    let image: Image?
    let size: CGFloat

    var body: some View {
        Group {
            if let image {
                image.resizable().aspectRatio(contentMode: .fill)
            } else {
                ZStack {
                    Color.white.opacity(0.15)
                    Image(systemName: "music.note")
                        .font(.system(size: size * 0.4))
                        .foregroundColor(.white.opacity(0.8))
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size > 48 ? 10 : 8))
    }
}

private struct ProgressLine: View {
    let progress: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.25))
                Capsule()
                    .fill(Color.white)
                    .frame(width: max(0, min(1, progress)) * geo.size.width)
            }
        }
        .frame(height: 3)
    }
}

/// A bottom-row action, styled after the app's `PlayerFabs` cluster: the
/// prominent one (Tune In) fills white-on-tint, the secondary (Shuffle) is a
/// translucent chip.
private struct ActionPill: View {
    var systemImage: String?
    let title: String
    let prominent: Bool
    var leadingDot: Bool = false

    var body: some View {
        HStack(spacing: 7) {
            if leadingDot {
                Circle().fill(Color.white).frame(width: 8, height: 8)
            } else if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 14, weight: .semibold))
            }
            Text(title)
                .font(.app(size: 14, weight: .semibold))
        }
        .foregroundColor(prominent ? .black : .white)
        .frame(maxWidth: .infinity)
        .frame(height: 38)
        .background(prominent ? Color.white : Color.white.opacity(0.18))
        .clipShape(Capsule())
    }
}

private struct BrandMark: View {
    var body: some View {
        Text("Soulector")
            .font(.app(size: 12, weight: .bold))
            .foregroundColor(.white.opacity(0.8))
    }
}

private struct RadioBadge: View {
    let on: Bool
    var body: some View {
        if on {
            HStack(spacing: 5) {
                Circle().fill(Color.white).frame(width: 7, height: 7)
                Text("On Air")
                    .font(.app(size: 11, weight: .semibold))
                    .foregroundColor(.white)
            }
        }
    }
}

// MARK: - Helpers

extension Color {
    /// The widget card tint: keep the album swatch's hue and saturation but
    /// clamp lightness into a mid-dark band so white text and controls stay
    /// legible — the Spotify-style tinted card, drawn from "the upper mark".
    static func soulectorCard(hsl: [Double]?) -> Color {
        guard let hsl, hsl.count >= 3 else { return Color(white: 0.16) }
        let h = hsl[0]
        let s = hsl[1]
        let l = min(max(hsl[2], 0.28), 0.42)
        // HSL → HSB for SwiftUI's Color(hue:saturation:brightness:).
        let b = l + s * min(l, 1 - l)
        let sHSB = b == 0 ? 0 : 2 * (1 - l / b)
        return Color(hue: h, saturation: sHSB, brightness: b)
    }
}

extension View {
    /// iOS 17 requires `containerBackground` for the widget's background; on
    /// iOS 16 the color fills the tile directly.
    @ViewBuilder
    func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(color, for: .widget)
        } else {
            padding(16).background(color)
        }
    }
}
