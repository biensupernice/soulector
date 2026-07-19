import SwiftUI

/// Temporary variant controls for auditioning accent treatments, driven by
/// the paintpalette menu next to the search button. Settings persist in
/// UserDefaults (via @AppStorage at the call sites) so variants can be judged
/// across launches and episodes. Remove once the choices settle.

/// Color of text (and small glyphs) sitting on accent-filled surfaces —
/// the episode sheet and the On Air segment fill.
enum TextOnAccent: String, CaseIterable, Identifiable {
    case white
    case black
    case auto

    static let storageKey = "soulector.textOnAccent"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .white: return "White"
        case .black: return "Black"
        case .auto: return "Auto (contrast)"
        }
    }

    func color(over accent: AccentColor?) -> Color {
        switch self {
        case .white:
            return .white
        case .black:
            return Color(white: 0.09)
        case .auto:
            guard let accent else { return .white }
            return accent.prefersDarkText ? Color(white: 0.09) : .white
        }
    }
}

/// Color combinations for the floating radio/shuffle cluster.
enum FabStyle: String, CaseIterable, Identifiable {
    /// White pill, accent content (the web look; current default).
    case whiteAccent
    /// Accent-filled pill, white content.
    case accentWhite
    /// Near-black pill, lifted (on-dark) accent content.
    case blackAccent

    static let storageKey = "soulector.fabStyle"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .whiteAccent: return "White · Accent"
        case .accentWhite: return "Accent · White"
        case .blackAccent: return "Black · Accent"
        }
    }
}
