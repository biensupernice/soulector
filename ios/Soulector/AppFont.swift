import SwiftUI

/// Space Grotesk — the same faces the web app self-hosts (`public/fonts`),
/// converted to TTF, bundled in `Fonts/`, and registered via `UIAppFonts`.
///
/// Use `.app(size:weight:)` wherever the web look should apply. SF Symbols
/// keep `.system` fonts: symbols don't render in custom fonts, they only
/// derive their point size and weight from a system font.
extension Font {
    static func app(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(appFaceName(for: weight), size: size)
    }

    private static func appFaceName(for weight: Font.Weight) -> String {
        switch weight {
        case .ultraLight, .thin, .light:
            return "SpaceGrotesk-Light"
        case .medium:
            return "SpaceGrotesk-Medium"
        case .semibold:
            return "SpaceGrotesk-SemiBold"
        case .bold, .heavy, .black:
            return "SpaceGrotesk-Bold"
        default:
            return "SpaceGrotesk-Regular"
        }
    }
}
