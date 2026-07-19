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

/// Color combinations for the floating radio/shuffle cluster, roughly
/// "pill · content" (with the On Air fill noted where it differs).
enum FabStyle: String, CaseIterable, Identifiable {
    /// White pill, accent content, accent On Air fill (the web look; default).
    case whiteAccent
    /// White pill, near-black content, black On Air fill (pre-accent look).
    case whiteBlack
    /// White pill, near-black content; accent appears only as the On Air fill.
    case whiteBlackAccentAir
    /// Accent-filled pill, white content, white On Air fill with accent text.
    case accentWhite
    /// Near-black pill, lifted (on-dark) accent content and On Air fill.
    case blackAccent
    /// Near-black pill, white content; accent appears only as the On Air fill.
    case blackWhiteAccentAir
    /// Near-black pill, white content, white On Air fill (monochrome dark).
    case blackWhite

    static let storageKey = "soulector.fabStyle"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .whiteAccent: return "White · Accent"
        case .whiteBlack: return "White · Black"
        case .whiteBlackAccentAir: return "White · Black · Accent Air"
        case .accentWhite: return "Accent · White"
        case .blackAccent: return "Black · Accent"
        case .blackWhiteAccentAir: return "Black · White · Accent Air"
        case .blackWhite: return "Black · White"
        }
    }
}
