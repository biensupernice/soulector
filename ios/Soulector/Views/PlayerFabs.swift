import SwiftUI

/// The floating radio/shuffle cluster, ported from the web
/// (`src/client/EpisodesScreen/PlayerFabs.tsx`): one connected pill with a
/// radio segment and a shuffle segment. On air the radio side expands into an
/// accent-filled "On Air" pill while shuffle collapses to just its icon;
/// tuning away reverses it. The web accent is near-black on white, which is
/// what makes the white pill pop against this app's black background.
struct PlayerFabs: View {
    let on: Bool
    let onRadioTap: () -> Void
    let onShuffleTap: () -> Void

    // Same accent as the web cluster: hsl(0 0% 9%).
    private static let accent = Color(white: 0.09)
    // Matches the web cluster's spring (bounce 0.18, duration 0.45).
    private static let spring = Animation.spring(duration: 0.45, bounce: 0.18)

    var body: some View {
        HStack(spacing: 0) {
            radioSegment
            Rectangle()
                .fill(Self.accent.opacity(0.2))
                .frame(width: 1)
            shuffleSegment
        }
        .fixedSize()
        .background(Color.white)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(Self.accent.opacity(0.3), lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 10, x: 0, y: 4)
        .animation(Self.spring, value: on)
    }

    private var radioSegment: some View {
        Button(action: onRadioTap) {
            Group {
                if on {
                    HStack(spacing: 8) {
                        PulseDot()
                        Text("On Air")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 20)
                } else {
                    Image(systemName: "dot.radiowaves.left.and.right")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(Self.accent)
                        .padding(.horizontal, 16)
                }
            }
            .frame(minHeight: 24)
            .padding(.vertical, 12)
            .background(on ? Self.accent : Color.clear)
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
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .padding(.horizontal, 20)
                }
            }
            .foregroundColor(Self.accent)
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
    @State private var pulsing = false

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.white.opacity(0.75))
                .frame(width: 10, height: 10)
                .scaleEffect(pulsing ? 2.2 : 1)
                .opacity(pulsing ? 0 : 0.75)
                // Scoped to this circle. A withAnimation in onAppear would
                // fire inside the cluster's morph spring transaction and leak
                // the repeatForever onto the rest of the screen's layout.
                .animation(.easeOut(duration: 1).repeatForever(autoreverses: false), value: pulsing)
            Circle()
                .fill(Color.white)
                .frame(width: 10, height: 10)
        }
        .onAppear { pulsing = true }
    }
}
