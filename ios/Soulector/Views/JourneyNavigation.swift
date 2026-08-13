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

    static let storageKey = "soulector.journey.navigation"

    /// The one that ships until something beats it. Full screen, since it's the
    /// only container that can keep the Mini Player.
    static let current: JourneyNavigation = .fullScreen

    /// The variants actually wired up. Each lands in its own change and joins
    /// this list then, so the switcher never offers a choice that does nothing.
    static let available: [JourneyNavigation] = allCases

    var id: String { rawValue }

    var title: String {
        switch self {
        case .peek:       return "Peek"
        case .inlineList: return "Open in the list"
        case .fullScreen: return "Full screen"
        }
    }

    /// What you'd notice, not how it's built.
    var detail: String {
        switch self {
        case .peek:       return "A look that costs nothing to close"
        case .inlineList: return "Connections open where the track is"
        case .fullScreen: return "The player bar stays with you"
        }
    }

    var symbol: String {
        switch self {
        case .peek:       return "eye"
        case .inlineList: return "list.bullet.indent"
        case .fullScreen: return "rectangle.portrait"
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
    static let all: [JourneyLayers] = [.routeRail, .nowPlayingStrip]

    var title: String {
        switch self {
        case .routeRail:       return "Route rail"
        case .nowPlayingStrip: return "Playing strip"
        default:               return "Layers"
        }
    }

    var symbol: String {
        switch self {
        case .routeRail:       return "rectangle.grid.1x2"
        case .nowPlayingStrip: return "speaker.wave.2"
        default:               return "square.stack"
        }
    }
}

// MARK: - What Track Episodes shows

/// How the list of other episodes is laid out. A record with one connection
/// renders one row and a screenful of nothing, which is the complaint these
/// answer — differently.
enum TrackEpisodesStyle: String, CaseIterable, Identifiable, Codable {
    /// Today: rows, one per episode.
    case list
    /// Artwork cards, two across. One to four destinations fill a screen the
    /// way a list of one never will.
    case shelf
    /// A card per set, big enough to say something: where the record falls in
    /// that set, drawn and named, and the record you'd come out into. The one
    /// idea from the first round that landed — arriving somewhere is easier to
    /// choose than going somewhere.
    case landing
    /// The same card, but the context is that set's cue sheet around the drop:
    /// the record before, the record itself, the two after. You see the stretch
    /// you're walking into rather than a description of it.
    case runway
    /// The same card, with the whole set as a strip of its track marks and the
    /// one you'd drop into lit. Says how dense the set is and where you enter
    /// it, which "deep in it" only approximates.
    case arc

    static let storageKey = "soulector.trackEpisodes.style"
    static let current: TrackEpisodesStyle = .list

    var id: String { rawValue }

    /// The card layouts share their chrome and differ only in the context
    /// panel, so the screen builds them through one path.
    var isCard: Bool { self == .landing || self == .runway || self == .arc }

    var title: String {
        switch self {
        case .list:    return "Rows"
        case .shelf:   return "Artwork shelf"
        case .landing: return "Where it lands"
        case .runway:  return "What you land in"
        case .arc:     return "Shape of the set"
        }
    }

    /// What you'd notice, not how it's built.
    var detail: String {
        switch self {
        case .list:    return "One row each"
        case .shelf:   return "Artwork, two across"
        case .landing: return "Position in the set, and what's next"
        case .runway:  return "The cue sheet around the drop"
        case .arc:     return "Every track, the drop lit"
        }
    }

    var symbol: String {
        switch self {
        case .list:    return "list.bullet"
        case .shelf:   return "square.grid.2x2"
        case .landing: return "waveform"
        case .runway:  return "text.line.first.and.arrowtriangle.forward"
        case .arc:     return "chart.bar.xaxis"
        }
    }
}

/// Additions to Track Episodes, each independent of the others and of the
/// layout, so they can be felt one at a time or together.
struct TrackEpisodesExtras: OptionSet, Codable {
    let rawValue: Int

    /// Include the episode you came from, marked as where you're standing. A
    /// one-connection record then reads as a fact about two episodes rather
    /// than a stub — and it's truer: this record's homes include this one.
    static let youAreHere = TrackEpisodesExtras(rawValue: 1 << 0)
    /// Under each destination, what plays either side of the record over there.
    /// Fills the screen with the thing you'd actually choose on.
    static let landingContext = TrackEpisodesExtras(rawValue: 1 << 1)
    /// When there's little to say — one or two connections — answer from a tray
    /// instead of a whole screen. Makes "is Track Episodes a place?" a question
    /// about content rather than a single answer for every record.
    static let adaptiveTray = TrackEpisodesExtras(rawValue: 1 << 2)

    static let storageKey = "soulector.trackEpisodes.extras"
    static let none: TrackEpisodesExtras = []
    static let all: [TrackEpisodesExtras] = [.youAreHere, .landingContext, .adaptiveTray]

    /// Above this many connections the screen has enough to say on its own.
    static let trayThreshold = 2

    var title: String {
        switch self {
        case .youAreHere:     return "You are here"
        case .landingContext: return "Landing context"
        case .adaptiveTray:   return "Tray when sparse"
        default:              return "Extras"
        }
    }

    var symbol: String {
        switch self {
        case .youAreHere:     return "mappin"
        case .landingContext: return "text.alignleft"
        case .adaptiveTray:   return "rectangle.bottomhalf.filled"
        default:              return "square.stack"
        }
    }
}

/// How an armed row marks itself.
enum ArmedRowStyle: String, CaseIterable, Identifiable, Codable {
    /// Today: the row fills edge to edge as the record plays out.
    case sweep
    /// The same fill, inset and rounded, so it reads as a card rather than a
    /// selection that ran off the sides.
    case card
    /// A left bar plus a quiet fill — how the tracklist already marks the
    /// playing track, borrowed so the two agree.
    case bar

    static let storageKey = "soulector.trackEpisodes.armedRow"
    static let current: ArmedRowStyle = .sweep

    var id: String { rawValue }

    var title: String {
        switch self {
        case .sweep: return "Full sweep"
        case .card:  return "Inset card"
        case .bar:   return "Accent bar"
        }
    }
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
    /// A journey that can't start until the episode sheet is out of the way.
    /// Dismissing and pushing in the same turn drops the push, so the full-screen
    /// variant parks the tapped track here and the root picks it up on dismissal.
    @Published var pending: TrackAppearance?

    var isActive: Bool { origin != nil || !path.isEmpty || expandedOrder != nil }

    /// Opening is the one place that knows about variants; every call site just
    /// hands over the track that was tapped.
    func open(_ appearance: TrackAppearance, variant: JourneyNavigation) {
        Diagnostics.breadcrumb("journey open · \(variant.rawValue) · \(appearance.episode.name) / \(appearance.track.name)")
        switch variant {
        case .peek:
            origin = appearance
        case .fullScreen:
            // A journey already in flight continues rather than starting over.
            // This is reached from the episode sheet, which the Mini Player can
            // raise *over* a running journey — so the tapped track is usually a
            // record in a set the route already passed through, and replacing
            // the path threw the whole route away.
            //
            // Truncating to that set and pushing keeps the rail honest: you
            // went back to it and moved sideways from there, which is what the
            // taps actually were. A set that isn't on the route at all has
            // nothing to continue, so it opens a new journey.
            if let index = path.lastIndex(where: { $0.episode.id == appearance.episode.id }) {
                path = Array(path.prefix(index + 1)) + [.track(appearance)]
            } else {
                path = [.track(appearance)]
            }
        case .inlineList:
            expandedOrder = appearance.track.order
        }
    }

    /// A transition landed. The point of arranging one was to end up over
    /// there, so leave the user looking at that episode's tracks, at the record
    /// that carried them — starting a journey if there wasn't one.
    ///
    /// The in-place variants have no path to push onto; for them the episode
    /// sheet retargeting *is* arriving, so they say no here and let it happen.
    @discardableResult
    func landed(_ transition: QueuedTransition, variant: JourneyNavigation) -> Bool {
        guard variant.hasPushedPath else { return false }
        Diagnostics.breadcrumb("landed · \(transition.episode.name) · push Episode Tracks")
        path.append(.episode(transition.episode, landedOn: transition.track.order))
        return true
    }

    /// Where a queued transition was arranged from: the record playing now, and
    /// everywhere else it turns up — which is the screen that shows the pending
    /// one sitting armed in the list. Returned rather than opened, because the
    /// full-screen variant has to close the sheet before it can go anywhere.
    func sourceAppearance(playing: PlayerStore) -> TrackAppearance? {
        guard let episode = playing.currentEpisode else { return nil }
        let now = playing.currentTime
        let record = playing.currentTracks.last { track in
            guard let timestamp = track.timestamp else { return false }
            return Double(timestamp) <= now
        }
        guard let record else { return nil }
        Diagnostics.breadcrumb("on deck tapped · source \(record.name)")
        return TrackAppearance(episode: episode, track: record)
    }

    func end() {
        Diagnostics.breadcrumb("journey end · depth \(path.count)")
        path = []
        origin = nil
        expandedOrder = nil
        pending = nil
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

    func journeyLayers(_ layers: JourneyLayers) -> some View {
        environment(\.journeyLayers, layers)
    }

    func trackEpisodesOptions(
        style: TrackEpisodesStyle,
        extras: TrackEpisodesExtras,
        armedRow: ArmedRowStyle
    ) -> some View {
        environment(\.trackEpisodesStyle, style)
            .environment(\.trackEpisodesExtras, extras)
            .environment(\.armedRowStyle, armedRow)
    }
}

private struct TrackEpisodesStyleKey: EnvironmentKey {
    static let defaultValue = TrackEpisodesStyle.current
}

private struct TrackEpisodesExtrasKey: EnvironmentKey {
    static let defaultValue = TrackEpisodesExtras.none
}

private struct ArmedRowStyleKey: EnvironmentKey {
    static let defaultValue = ArmedRowStyle.current
}

extension EnvironmentValues {
    var trackEpisodesStyle: TrackEpisodesStyle {
        get { self[TrackEpisodesStyleKey.self] }
        set { self[TrackEpisodesStyleKey.self] = newValue }
    }
    var trackEpisodesExtras: TrackEpisodesExtras {
        get { self[TrackEpisodesExtrasKey.self] }
        set { self[TrackEpisodesExtrasKey.self] = newValue }
    }
    var armedRowStyle: ArmedRowStyle {
        get { self[ArmedRowStyleKey.self] }
        set { self[ArmedRowStyleKey.self] = newValue }
    }
}

private struct JourneyLayersKey: EnvironmentKey {
    static let defaultValue = JourneyLayers.none
}

extension EnvironmentValues {
    var journeyLayers: JourneyLayers {
        get { self[JourneyLayersKey.self] }
        set { self[JourneyLayersKey.self] = newValue }
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
    @AppStorage(JourneyLayers.storageKey) private var layers = JourneyLayers.none
    @AppStorage(TrackEpisodesStyle.storageKey) private var episodesStyle = TrackEpisodesStyle.current
    @AppStorage(TrackEpisodesExtras.storageKey) private var extras = TrackEpisodesExtras.none
    @AppStorage(ArmedRowStyle.storageKey) private var armedRow = ArmedRowStyle.current
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

            Section("Layers") { layerToggles }

            Section("Track Episodes") {
                Picker("Layout", selection: $episodesStyle) {
                    ForEach(TrackEpisodesStyle.allCases) { option in
                        Label(option.title, systemImage: option.symbol).tag(option)
                    }
                }

                ForEach(TrackEpisodesExtras.all, id: \.rawValue) { extra in
                    Button {
                        if extras.contains(extra) { extras.subtract(extra) } else { extras.insert(extra) }
                    } label: {
                        Label(extra.title, systemImage: extras.contains(extra) ? "checkmark" : extra.symbol)
                    }
                }
            }

            Section("Armed row") {
                Picker("Armed row", selection: $armedRow) {
                    ForEach(ArmedRowStyle.allCases) { option in
                        Text(option.title).tag(option)
                    }
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

    /// The layers are additive, so they're toggles rather than a picker — any
    /// of them can ride along with any container.
    private var layerToggles: some View {
        ForEach(JourneyLayers.all, id: \.rawValue) { layer in
            Button {
                if layers.contains(layer) { layers.subtract(layer) } else { layers.insert(layer) }
            } label: {
                Label(layer.title, systemImage: layers.contains(layer) ? "checkmark" : layer.symbol)
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
                Diagnostics.breadcrumb("variant switch · \(variant.rawValue) -> \(newValue.rawValue)")
                journey.end()
                variant = newValue
            }
        )
    }
}
