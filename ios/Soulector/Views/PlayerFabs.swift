import SwiftUI

/// The floating radio/shuffle cluster, ported from the web
/// (`src/client/EpisodesScreen/PlayerFabs.tsx`): one connected pill with a
/// radio segment and a shuffle segment. On air the radio side expands into an
/// accent-filled "On Air" pill while shuffle collapses to just its icon;
/// tuning away reverses it. `style` selects one of the debug color combos
/// being auditioned (see FabStyle).
struct PlayerFabs: View {
    let on: Bool
    let style: FabStyle
    /// Dark-leaning album accent for light surfaces (web `--accent`).
    let accentOnLight: Color
    /// Lightness-lifted album accent for dark surfaces.
    let accentOnDark: Color
    /// Text/dot color over the accent fill (the text-on-accent variant).
    let onAirText: Color
    let onRadioTap: () -> Void
    let onShuffleTap: () -> Void

    // Matches the web cluster's spring (bounce 0.18, duration 0.45).
    private static let spring = Animation.spring(duration: 0.45, bounce: 0.18)
    private static let nearBlack = Color(white: 0.09)

    // MARK: Style mapping

    private var pillBackground: Color {
        switch style {
        case .whiteAccent, .whiteBlack, .whiteBlackAccentAir: return .white
        case .accentWhite: return accentOnLight
        case .blackAccent, .blackWhiteAccentAir, .blackWhite: return Self.nearBlack
        }
    }

    /// Icons/text on the pill background.
    private var content: Color {
        switch style {
        case .whiteAccent: return accentOnLight
        case .whiteBlack, .whiteBlackAccentAir: return Self.nearBlack
        case .accentWhite, .blackWhiteAccentAir, .blackWhite: return .white
        case .blackAccent: return accentOnDark
        }
    }

    private var onAirFill: Color {
        switch style {
        case .whiteAccent, .whiteBlackAccentAir, .blackWhiteAccentAir: return accentOnLight
        case .whiteBlack: return Self.nearBlack
        case .accentWhite, .blackWhite: return .white
        case .blackAccent: return accentOnDark
        }
    }

    /// Text/dot inside the On Air fill.
    private var onAirContent: Color {
        switch style {
        case .whiteAccent, .whiteBlackAccentAir, .blackWhiteAccentAir: return onAirText
        case .whiteBlack: return .white
        case .accentWhite: return accentOnLight
        case .blackAccent, .blackWhite: return Self.nearBlack
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            radioSegment
            Rectangle()
                .fill(content.opacity(0.2))
                .frame(width: 1)
            shuffleSegment
        }
        .fixedSize()
        .background(pillBackground)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(content.opacity(0.3), lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 10, x: 0, y: 4)
        .animation(Self.spring, value: on)
    }

    private var radioSegment: some View {
        Button(action: onRadioTap) {
            Group {
                if on {
                    HStack(spacing: 8) {
                        PulseDot(color: onAirContent)
                        Text("On Air")
                            .font(.app(size: 15, weight: .semibold))
                            .foregroundColor(onAirContent)
                    }
                    .padding(.horizontal, 20)
                } else {
                    Image(systemName: "dot.radiowaves.left.and.right")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(content)
                        .padding(.horizontal, 16)
                }
            }
            .frame(minHeight: 24)
            .padding(.vertical, 12)
            .background(on ? onAirFill : Color.clear)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(on ? "On Air" : "Radio")
        .accessibilityHint(on ? "Tap to tune out" : "Tune in to the radio")
    }

    private var shuffleSegment: some View {
        Button(action: onShuffleTap) {
            Group {
                if on {
                    Image(systemName: "shuffle")
                        .font(.system(size: 17, weight: .semibold))
                        .padding(.horizontal, 16)
                } else {
                    HStack(spacing: 8) {
                        Image(systemName: "shuffle")
                            .font(.system(size: 15, weight: .semibold))
                        Text("Play Random")
                            .font(.app(size: 15, weight: .semibold))
                    }
                    .padding(.horizontal, 20)
                }
            }
            .foregroundColor(content)
            .frame(minHeight: 24)
            .padding(.vertical, 12)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Play Random")
        .accessibilityHint("Play a random episode")
    }
}

/// The web cluster's `animate-ping` dot: a solid core with a ring that
/// expands and fades on repeat.
private struct PulseDot: View {
    let color: Color
    @State private var pulsing = false

    var body: some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.75))
                .frame(width: 10, height: 10)
                .scaleEffect(pulsing ? 2.2 : 1)
                .opacity(pulsing ? 0 : 0.75)
                // Scoped to this circle. A withAnimation in onAppear would
                // fire inside the cluster's morph spring transaction and leak
                // the repeatForever onto the rest of the screen's layout.
                .animation(.easeOut(duration: 1).repeatForever(autoreverses: false), value: pulsing)
            Circle()
                .fill(color)
                .frame(width: 10, height: 10)
        }
        .onAppear { pulsing = true }
    }
}
