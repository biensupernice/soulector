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
    var date: Date
    var snapshot: NowPlayingSnapshot
    var artwork: Image?
    /// True when the card is reporting what the broadcast schedule says is on
    /// the air rather than this device's own playback — see `LiveRadioPreview`.
    var isScheduledPreview: Bool = false
    /// When to ask WidgetKit for the next timeline.
    var refreshAt: Date = Date().addingTimeInterval(120)
}

struct NowPlayingProvider: TimelineProvider {
    func placeholder(in context: Context) -> NowPlayingEntry {
        NowPlayingEntry(date: Date(), snapshot: .preview, artwork: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (NowPlayingEntry) -> Void) {
        Task { completion(await currentEntry()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NowPlayingEntry>) -> Void) {
        Task {
            let entry = await currentEntry()
            completion(Timeline(entries: entries(from: entry), policy: .after(entry.refreshAt)))
        }
    }

    /// When the position is moving — we're playing, or we're reporting a live
    /// broadcast — hand WidgetKit a run of future entries with the progress
    /// line rolled forward. The line then advances on its own, without
    /// spending a timeline reload per tick.
    private func entries(from entry: NowPlayingEntry) -> [NowPlayingEntry] {
        let advancing = entry.snapshot.isPlaying || entry.isScheduledPreview
        guard advancing, entry.snapshot.durationSeconds > 0 else { return [entry] }

        let step: TimeInterval = 60
        let horizon = max(step, entry.refreshAt.timeIntervalSince(entry.date))
        let count = min(Int(horizon / step), 30)
        guard count > 0 else { return [entry] }

        return (0...count).map { i in
            let offset = Double(i) * step
            var future = entry
            future.date = entry.date.addingTimeInterval(offset)
            future.snapshot = entry.snapshot.advanced(by: offset)
            return future
        }
    }

    private func currentEntry() async -> NowPlayingEntry {
        // Preferred: whatever the app is actually playing. The app reloads the
        // timeline on every playback change, so this stays current.
        let snapshot = NowPlayingStore.load()
        if snapshot.hasEpisode {
            var artwork: Image?
            if let data = NowPlayingStore.loadArtworkData(), let ui = UIImage(data: data) {
                artwork = Image(uiImage: ui)
            }
            return NowPlayingEntry(date: Date(), snapshot: snapshot, artwork: artwork)
        }

        // Nothing shared — either nothing has played yet, or this build's
        // signing doesn't carry the App Group. Report the live broadcast,
        // which the widget can work out on its own.
        let station = snapshot.collective ?? soulectorDefaultCollective
        if let live = await LiveRadioPreview.current(collective: station) {
            // Refresh when the broadcast moves to the next episode, but check
            // back at least every 15 minutes so the progress line keeps up.
            let cap = Date().addingTimeInterval(15 * 60)
            return NowPlayingEntry(
                date: Date(),
                snapshot: live.snapshot,
                artwork: live.artwork.map(Image.init(uiImage:)),
                isScheduledPreview: true,
                refreshAt: min(live.slotEndsAt, cap)
            )
        }

        // Offline with an empty cache: fall through to the empty state.
        return NowPlayingEntry(
            date: Date(),
            snapshot: snapshot,
            artwork: nil,
            refreshAt: Date().addingTimeInterval(15 * 60)
        )
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
                if entry.isScheduledPreview {
                    OnAirEyebrow()
                }
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
                if entry.isScheduledPreview {
                    OnAirEyebrow()
                }
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

            // Showing the broadcast rather than our own playback? Then the
            // round button starts it, which means tuning in.
            Link(destination: entry.isScheduledPreview
                 ? SoulectorAction.tuneIn.url
                 : SoulectorAction.togglePlayPause.url) {
                ZStack {
                    Circle().fill(Color.white)
                    Image(systemName: !entry.isScheduledPreview && s.isPlaying ? "pause.fill" : "play.fill")
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

/// Marks the card as reporting the live broadcast rather than this device's
/// playback, so "on air now" never reads as "you're playing this".
private struct OnAirEyebrow: View {
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(Color.white.opacity(0.9)).frame(width: 6, height: 6)
            Text("ON AIR NOW")
                .font(.app(size: 10, weight: .bold))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.85))
        }
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
