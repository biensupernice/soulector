import Foundation
import SwiftUI

// MARK: - Audio

/// How the sound gets from one set to the other at the transition.
enum TransitionAudio: String, CaseIterable, Identifiable, Codable {
    /// Both sets play the record's outro at once and trade places over it.
    /// They're the same recording at the same point in it, so the overlap
    /// lands as one record heard twice rather than two records fighting.
    case blend
    /// The reload. The record is running out here while the other set drops
    /// it again from the top underneath, so it comes back around instead of
    /// finishing — and you carry on into that set having heard it twice.
    case runBack
    /// The outgoing set ducks away over the record's last seconds; the
    /// incoming one comes up under its own.
    case fade

    var id: String { rawValue }

    var title: String {
        switch self {
        case .blend:   return "Blend"
        case .runBack: return "Run back"
        case .fade:    return "Fade"
        }
    }

    var detail: String {
        switch self {
        case .blend:   return "The record over itself"
        case .runBack: return "It comes back around"
        case .fade:    return "Out, then in"
        }
    }

    var symbol: String {
        switch self {
        case .blend:   return "waveform"
        case .runBack: return "arrow.counterclockwise"
        case .fade:    return "speaker.wave.2"
        }
    }

    /// How long before the record ends the transition starts working. The run
    /// back starts earliest: it needs room for the record to be recognisably
    /// under way again before the copy that's been playing runs out.
    var lead: Double {
        switch self {
        case .blend:   return 4
        case .runBack: return 5
        case .fade:    return 2.5
        }
    }

    /// Whether the incoming set comes up while the outgoing one is still
    /// playing. The two overlapping styles are the whole point of arranging a
    /// transition in advance; the fade could be done on the spot.
    var overlaps: Bool {
        switch self {
        case .blend, .runBack: return true
        case .fade:            return false
        }
    }

    /// How far ahead of its landing point the incoming set starts rolling.
    /// Only the blend needs a head start — it has to already be inside the
    /// same outro when the two meet. The run back lands on the record's first
    /// beat by definition, so it starts there and plays forward.
    var deckLead: Double {
        self == .blend ? lead : 0
    }

    /// Which end of the shared record the transition lands on over there:
    /// the far side of it and onward into the set, or its very start.
    var landsAtRecordStart: Bool {
        self == .runBack
    }

    /// How long the incoming set takes to come up once it starts. The
    /// overlapping styles do their rising during the overlap.
    var fadeIn: Double {
        switch self {
        case .blend, .runBack: return 0
        case .fade:            return 1.5
        }
    }
}

// MARK: - The arrangement

/// A transition arranged in advance: when the record playing now runs out, take
/// the same record's exit in another set and carry on from there.
///
/// Both ends are the *end* of the shared record — you hear it once, in the set
/// you're already in, and come out the other side into what the other DJ
/// played next.
struct QueuedTransition: Identifiable, Equatable {
    /// The episode being transitioned into.
    let episode: Episode
    /// The record the transition rides, as it appears in that set.
    let track: EpisodeTrack
    /// Where in the *current* episode the transition happens — the moment the
    /// record ends there.
    let fireAt: Double
    /// Where in the target episode playback picks up — the moment the same
    /// record ends there.
    let startAt: Double
    /// Position in the current episode when this was arranged, so the wait can
    /// be drawn as a fraction of itself.
    let armedFrom: Double
    let audio: TransitionAudio

    /// The playing this transition lands on, so it can be matched against the
    /// appearance in a list without either side formatting a key by hand.
    var id: TrackPlaying { TrackPlaying(episodeId: episode.id, order: track.order) }

    /// 0 at the moment it was arranged, 1 at the transition.
    func progress(at time: Double) -> Double {
        let span = fireAt - armedFrom
        guard span > 0 else { return 1 }
        return min(1, max(0, (time - armedFrom) / span))
    }
}

// MARK: - Planning one

extension QueuedTransition {
    /// Where the record playing now runs out — the moment a transition would
    /// happen. Nil when there's nothing to hand over from: no episode playing,
    /// no cue sheet to find the edge of the record in, or an outro already upon
    /// us. That nil is also what greys the transition out wherever it's offered.
    @MainActor
    static func transitionPoint(player: PlayerStore) -> Double? {
        guard player.hasEpisode else { return nil }
        let playing = player.currentTracks
        guard !playing.isEmpty else { return nil }

        let now = player.currentTime
        guard let index = playing.lastIndex(where: { track in
            guard let timestamp = track.timestamp else { return false }
            return Double(timestamp) <= now
        }) else { return nil }

        let endsHere: Double
        if index + 1 < playing.count, let next = playing[index + 1].timestamp {
            endsHere = Double(next)
        } else if player.duration > 0 {
            endsHere = player.duration
        } else {
            return nil
        }
        // Too close to arrange — by the time the tap registers it's already gone.
        guard endsHere - now > 2 else { return nil }
        return endsHere
    }

    /// Works out the crossing to a given appearance. Lives here rather than on
    /// one screen because more than one surface offers this now, and two copies
    /// of the landing arithmetic would drift.
    @MainActor
    static func plan(
        to other: TrackAppearance,
        audio: TransitionAudio,
        player: PlayerStore,
        graph: TrackGraph
    ) -> QueuedTransition? {
        guard let endsHere = transitionPoint(player: player) else { return nil }
        let now = player.currentTime

        // Where we come in over there. Usually the far side of the shared
        // record — you've just heard it, so you carry on into what that DJ
        // played next. The run back instead lands on the record's own first
        // beat, so it comes around again under the copy that's ending here.
        let target = graph.tracks(forEpisode: other.episode.id)
        let landsAt: Double
        if audio.landsAtRecordStart {
            landsAt = other.track.timestamp.map(Double.init) ?? 0
        } else if let match = target.firstIndex(where: { $0.order == other.track.order }),
                  match + 1 < target.count, let next = target[match + 1].timestamp {
            landsAt = Double(next)
        } else if let timestamp = other.track.timestamp {
            landsAt = Double(timestamp)
        } else {
            landsAt = 0
        }

        return QueuedTransition(
            episode: other.episode,
            track: other.track,
            fireAt: endsHere,
            startAt: landsAt,
            armedFrom: now,
            audio: audio
        )
    }
}
