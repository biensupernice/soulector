import SwiftUI

/// The navigation approaches being tried against each other for journeys.
///
/// All of them ship in the same build, switchable while you listen, because the
/// only way to tell these apart is to follow a few connections in each and
/// notice which one you stop fighting. When one wins, it becomes the behaviour
/// and this enum goes — the same way the last exploration's settings menu did.
///
/// What varies is only *where the journey lives*. The screens themselves
/// (`TrackEpisodesScreen`, `EpisodeTracksScreen`), the connections affordance
/// (`TrackConnectionsButton`) and everything about transitions are shared, so a
/// variant is a presentation decision rather than a fork of the feature.
enum JourneyNavigation: String, CaseIterable, Identifiable, Codable {
    /// Today: a journey sheet presented over the episode sheet, with its own
    /// navigation stack inside. Two modal layers, and the Mini Player is
    /// covered throughout.
    case modalSheet
    /// One modal. The episode sheet hosts the stack and the journey pushes
    /// within it, so a journey never adds a layer.
    case pushInSheet
    /// Track Episodes answers from a short sheet you can dismiss without going
    /// anywhere; picking one retargets the episode sheet in place. Looking is
    /// free, moving is deliberate — Wikipedia's page previews, and the way
    /// Serato answers "which crates hold this record" with a filtered panel
    /// rather than a destination.
    case peek
    /// Track Episodes stops being a screen at all: connections unfold under the
    /// track row, and picking one swaps the episode sheet in place. Roam's
    /// linked mentions — the reverse index is content, not a place to go.
    case inlineList
    /// The journey leaves the modals entirely and pushes over the Episodes
    /// list, so the Mini Player stays visible the whole way. What every music
    /// app does with lateral browsing, and what Maps does with a place card
    /// over a map it never hides.
    case fullScreen
    /// The path laid out sideways instead of stacked: each step is a full-width
    /// page, swipe right to go back and **left to go forward again**, which no
    /// navigation stack gives you. Miller columns folded onto a phone.
    case pager

    static let storageKey = "soulector.journey.navigation"

    /// The one that ships until something beats it.
    static let current: JourneyNavigation = .modalSheet

    /// The variants actually wired up. Each lands in its own change and joins
    /// this list then, so the switcher never offers a choice that does nothing.
    static let available: [JourneyNavigation] = [.modalSheet]

    var id: String { rawValue }

    var title: String {
        switch self {
        case .modalSheet:  return "Sheet over sheet"
        case .pushInSheet: return "Push in the sheet"
        case .peek:        return "Peek"
        case .inlineList:  return "Open in the list"
        case .fullScreen:  return "Full screen"
        case .pager:       return "Sideways pages"
        }
    }

    /// What you'd notice, not how it's built.
    var detail: String {
        switch self {
        case .modalSheet:  return "The journey opens on top of the episode"
        case .pushInSheet: return "The episode sheet carries you along"
        case .peek:        return "A look that costs nothing to close"
        case .inlineList:  return "Connections open where the track is"
        case .fullScreen:  return "The player bar stays with you"
        case .pager:       return "Swipe on, swipe back, swipe on again"
        }
    }

    var symbol: String {
        switch self {
        case .modalSheet:  return "square.on.square"
        case .pushInSheet: return "arrow.forward.square"
        case .peek:        return "eye"
        case .inlineList:  return "list.bullet.indent"
        case .fullScreen:  return "rectangle.portrait"
        case .pager:       return "rectangle.split.3x1"
        }
    }

    /// Whether starting a journey closes the episode sheet. Only the full-screen
    /// variant leaves it, and it has to: a sheet is anchored to the bottom of the
    /// screen at every detent, so nothing presented as one can leave the Mini
    /// Player showing underneath. Keeping the player bar visible and leaving the
    /// modals are the same decision.
    var leavesTheSheet: Bool { self == .fullScreen }

    /// Whether the journey keeps a route at all. The two in-place variants
    /// answer a connection where you stand, so there's nothing to push onto —
    /// which also means they owe an answer to "how do I get back", and the
    /// stack variants get that for free.
    var hasPushedPath: Bool { self != .inlineList && self != .peek }
}

// MARK: - Layers

/// What a journey shows *about itself*, on top of whatever container is drawing
/// it. These are orthogonal to `JourneyNavigation` on purpose — "where the
/// journey lives" and "how it reports where you are" are separate questions,
/// and pretending they were one is why half the ideas worth trying had nowhere
/// to sit. Any layer can ride along with any container.
struct JourneyLayers: OptionSet, Codable {
    let rawValue: Int

    /// The route as a rail of album-art chips: tap one to jump straight back to
    /// that step. Today's path is write-only — no labels, no jumping, no
    /// forward — which is the thing Finder's path bar and VS Code's
    /// breadcrumbs both exist to fix.
    static let routeRail = JourneyLayers(rawValue: 1 << 0)
    /// A strip naming both threads — what you're viewing, what's playing — with
    /// a Return control that appears only when they differ. Spotify's
    /// go-to-current, for the one case this app actually has.
    static let nowPlayingStrip = JourneyLayers(rawValue: 1 << 1)

    static let storageKey = "soulector.journey.layers"
    static let none: JourneyLayers = []
}

// MARK: - The journey in flight

/// One journey, however it's being rendered. The variants differ in where these
/// land on screen, not in what they are, so the state lives here and each
/// container reads the part it draws — otherwise the same journey would exist
/// three times in three `@State`s and switching would silently strand it.
@MainActor
final class JourneyCoordinator: ObservableObject {
    /// The pushed route, for the variants that have one.
    @Published var path: [JourneyStep] = []
    /// The track a modal journey was opened from; drives the sheet.
    @Published var origin: TrackAppearance?
    /// The track whose connections are unfolded in place, for the inline variant.
    @Published var expandedOrder: Int?

    var isActive: Bool { origin != nil || !path.isEmpty || expandedOrder != nil }

    /// Opening is the one place that knows about variants; every call site just
    /// hands over the track that was tapped.
    func open(_ appearance: TrackAppearance, variant: JourneyNavigation) {
        switch variant {
        // Both of these open a sheet on the track; they differ in how far it
        // comes up and what picking one does, not in what starts them.
        case .modalSheet, .peek:
            origin = appearance
        case .pushInSheet, .fullScreen, .pager:
            path = [.track(appearance)]
        case .inlineList:
            expandedOrder = appearance.track.order
        }
    }

    func end() {
        path = []
        origin = nil
        expandedOrder = nil
    }
}

// MARK: - Reading the choice

extension View {
    /// Journeys read the variant from the environment rather than each holding
    /// their own `@AppStorage`, so a switch mid-journey reaches every screen at
    /// once instead of some of them.
    func journeyNavigation(_ variant: JourneyNavigation) -> some View {
        environment(\.journeyNavigation, variant)
    }
}

private struct JourneyNavigationKey: EnvironmentKey {
    static let defaultValue = JourneyNavigation.current
}

extension EnvironmentValues {
    var journeyNavigation: JourneyNavigation {
        get { self[JourneyNavigationKey.self] }
        set { self[JourneyNavigationKey.self] = newValue }
    }
}

// MARK: - Picking one

/// The switcher, kept out of the journey's own chrome on purpose: that chrome
/// is one of the things being varied, so a control living inside it would
/// disappear in half the variants.
struct JourneyNavigationPicker: View {
    @AppStorage(JourneyNavigation.storageKey) private var variant = JourneyNavigation.current
    @EnvironmentObject private var journey: JourneyCoordinator

    var body: some View {
        // Nothing to choose between until a second variant lands.
        if JourneyNavigation.available.count > 1 {
            picker
        }
    }

    private var picker: some View {
        Menu {
            Picker("Journey navigation", selection: switching) {
                ForEach(JourneyNavigation.available) { option in
                    Label(option.title, systemImage: option.symbol).tag(option)
                }
            }
        } label: {
            ActionRowLabel(title: "Journeys: \(variant.title)", subtitle: variant.detail) {
                Image(systemName: variant.symbol)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
            }
        }
    }

    /// Switching ends whatever journey is open rather than trying to re-host it.
    /// Moving a live path from a sheet onto another stack means dismissing one
    /// container and pushing on another in the same frame, which is the race
    /// that drops the push — and a half-moved journey teaches you nothing about
    /// either variant anyway.
    private var switching: Binding<JourneyNavigation> {
        Binding(
            get: { variant },
            set: { newValue in
                guard newValue != variant else { return }
                journey.end()
                variant = newValue
            }
        )
    }
}
