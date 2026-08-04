import SwiftUI

/// A collective's brand mark, the way the web app draws it: the wordmarks are
/// artwork, not type set in the app font — Soulection's stretched sans and
/// Sasha Marie Radio's script don't exist in a font we ship, so setting their
/// names in Space Grotesk loses the brand entirely. The Love Below Hour has
/// only a symbol (no wordmark), so it pairs its mark with the name, as on web.
struct CollectiveLogo: View {
    /// Where the mark is being drawn. The picker trigger sits alone on the nav
    /// bar and carries the screen's identity, so it runs a size up from the
    /// dropdown rows.
    enum Placement {
        case navBar
        case menu

        var textSize: CGFloat { self == .navBar ? 22 : 18 }
        var markHeight: CGFloat { self == .navBar ? 22 : 19 }
        var wordmarkHeight: CGFloat { self == .navBar ? 15 : 13 }
        var scriptHeight: CGFloat { self == .navBar ? 24 : 21 }
        var spacing: CGFloat { self == .navBar ? 10 : 12 }
    }

    let collective: CollectiveFilter
    var placement: Placement = .menu

    // Aspect ratios of the vector assets, so a height is all a caller picks.
    private static let soulectionMarkAspect: CGFloat = 27.0 / 18.0
    private static let soulectionWordmarkAspect: CGFloat = 209.0 / 18.0
    private static let sashaMarieWordmarkAspect: CGFloat = 357.0 / 40.0

    var body: some View {
        switch collective {
        case .all:
            HStack(spacing: placement.spacing) {
                Image(systemName: "square.stack.fill")
                    .font(.system(size: placement.markHeight))
                    .frame(width: placement.markHeight * 1.3)
                    .foregroundColor(.white)
                name(collective.displayName)
            }
        case .soulection:
            HStack(spacing: placement.spacing) {
                artwork("SoulectionIcon", aspect: Self.soulectionMarkAspect, height: placement.markHeight)
                artwork(
                    "SoulectionLogotype",
                    aspect: Self.soulectionWordmarkAspect,
                    height: placement.wordmarkHeight,
                    label: collective.displayName
                )
            }
        case .sashaMarieRadio:
            artwork(
                "SashaMarieRadioLogotype",
                aspect: Self.sashaMarieWordmarkAspect,
                height: placement.scriptHeight,
                label: collective.displayName
            )
        case .theLoveBelowHour:
            HStack(spacing: placement.spacing) {
                artwork("TheLoveBelowIcon", aspect: 1, height: placement.markHeight + 4)
                name(collective.displayName)
            }
        }
    }

    private func name(_ text: String) -> some View {
        Text(text)
            .font(.app(size: placement.textSize, weight: .bold))
            .foregroundColor(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }

    /// Vector artwork drawn at a chosen height. `maxWidth` is its natural width
    /// at that height, so a mark keeps its intended size but still scales down
    /// (aspect intact) when the row is narrower than that — a long wordmark
    /// alongside the search button on a small phone.
    ///
    /// A wordmark *is* the collective's name, so it takes one as its label;
    /// symbols sit next to the name already and stay decorative.
    private func artwork(
        _ asset: String,
        aspect: CGFloat,
        height: CGFloat,
        label: String? = nil
    ) -> some View {
        Image(asset)
            .renderingMode(.template)
            .resizable()
            .aspectRatio(aspect, contentMode: .fit)
            .frame(maxWidth: height * aspect, maxHeight: height)
            .foregroundColor(.white)
            .accessibilityLabel(label ?? "")
            .accessibilityHidden(label == nil)
    }
}
