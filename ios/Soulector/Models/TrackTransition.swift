import Foundation

// MARK: - Audio

/// How the sound gets from one set to the other at the crossing.
enum TransitionAudio: String, CaseIterable, Identifiable, Codable {
    /// Straight swap the moment the record ends.
    case cut
    /// The outgoing set ducks away over the record's last seconds; the
    /// incoming one comes up under its own.
    case fade
    /// Both sets play the record's outro at once and trade places over it.
    /// They're the same recording at the same point in it, so the overlap
    /// lands as one record heard twice rather than two records fighting.
    case blend

    var id: String { rawValue }

    var title: String {
        switch self {
        case .cut:   return "Cut"
        case .fade:  return "Fade"
        case .blend: return "Blend"
        }
    }

    var detail: String {
        switch self {
        case .cut:   return "Straight swap"
        case .fade:  return "Out, then in"
        case .blend: return "The record over itself"
        }
    }

    /// How long before the record ends the crossing starts working.
    var lead: Double {
        switch self {
        case .cut:   return 0
        case .fade:  return 2.5
        case .blend: return 4
        }
    }

    /// How far ahead of its landing point the incoming set starts rolling.
    /// Only the blend needs a head start — that overlap *is* the blend.
    var deckLead: Double {
        self == .blend ? lead : 0
    }

    /// How long the incoming set takes to come up once it starts. The blend
    /// does its rising during the overlap, so it needs none here.
    var fadeIn: Double {
        switch self {
        case .cut:   return 0
        case .fade:  return 1.5
        case .blend: return 0
        }
    }
}

// MARK: - Visual

/// How the wait, and then the handover, look.
enum TransitionVisual: String, CaseIterable, Identifiable, Codable {
    /// A line of text on the queued row. Nothing else moves.
    case minimal
    /// A ring that drains as the record plays out.
    case ring
    /// The row fills like a loading bar, and the screen's colour drifts toward
    /// the set it's about to hand over to.
    case sweep

    var id: String { rawValue }

    var title: String {
        switch self {
        case .minimal: return "Minimal"
        case .ring:    return "Ring"
        case .sweep:   return "Sweep"
        }
    }

    var detail: String {
        switch self {
        case .minimal: return "Just the count"
        case .ring:    return "Draining ring"
        case .sweep:   return "Fills, and the colour drifts"
        }
    }
}

// MARK: - The arrangement

/// A crossing arranged in advance: when the record playing now runs out, take
/// the same record's exit in another set and carry on from there.
///
/// Both ends are the *end* of the shared record — you hear it once, in the set
/// you're already in, and come out the other side into what the other DJ
/// played next.
struct QueuedTransition: Identifiable, Equatable {
    /// The set being crossed into.
    let episode: Episode
    /// The record the crossing rides, as it appears in that set.
    let track: EpisodeTrack
    /// Where in the *current* episode the crossing happens — the moment the
    /// record ends there.
    let fireAt: Double
    /// Where in the target episode playback picks up — the moment the same
    /// record ends there.
    let startAt: Double
    /// Position in the current episode when this was arranged, so the wait can
    /// be drawn as a fraction of itself.
    let armedFrom: Double
    let audio: TransitionAudio
    let visual: TransitionVisual

    var id: String { "\(episode.id)#\(track.order)" }

    /// 0 at the moment it was arranged, 1 at the crossing.
    func progress(at time: Double) -> Double {
        let span = fireAt - armedFrom
        guard span > 0 else { return 1 }
        return min(1, max(0, (time - armedFrom) / span))
    }
}
