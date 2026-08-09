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
    /// Track Episodes stops being a screen: connections open under the track
    /// row, and picking one swaps the episode sheet in place. The path is never
    /// deeper than where you started.
    case inlineList
    /// The journey leaves the modals entirely and pushes over the Episodes
    /// list, so the Mini Player stays visible the whole way.
    case fullScreen

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
        case .inlineList:  return "Open in the list"
        case .fullScreen:  return "Full screen"
        }
    }

    /// What you'd notice, not how it's built.
    var detail: String {
        switch self {
        case .modalSheet:  return "The journey opens on top of the episode"
        case .pushInSheet: return "The episode sheet carries you along"
        case .inlineList:  return "Connections open where the track is"
        case .fullScreen:  return "The player bar stays with you"
        }
    }

    var symbol: String {
        switch self {
        case .modalSheet:  return "square.on.square"
        case .pushInSheet: return "arrow.forward.square"
        case .inlineList:  return "list.bullet.indent"
        case .fullScreen:  return "rectangle.portrait"
        }
    }

    /// Whether starting a journey closes the episode sheet. Only the full-screen
    /// variant leaves it, and it has to: a sheet is anchored to the bottom of the
    /// screen at every detent, so nothing presented as one can leave the Mini
    /// Player showing underneath. Keeping the player bar visible and leaving the
    /// modals are the same decision.
    var leavesTheSheet: Bool { self == .fullScreen }

    /// Whether the journey is a stack of pushed screens at all. The inline
    /// variant answers a connection in place, so it has no path to push onto.
    var hasPushedPath: Bool { self != .inlineList }
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
        case .modalSheet:
            origin = appearance
        case .pushInSheet, .fullScreen:
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
