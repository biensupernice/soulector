import { useCallback, useEffect, useRef } from "react";
import { event } from "nextjs-google-analytics";
import { radioSlotAt, radioStationKey } from "@/lib/radioSchedule";
import { EpisodeProjection } from "@/server/router";
import { usePlayerActions, usePlayerStore } from "./PlayerStore";
import { useRadioStore } from "./RadioStore";
import { useEpisodes } from "./useEpisodeHooks";
import { usePlayEpisodeMutation } from "./useEpisodesScreenState";
import { useCollectiveSelectStore } from "./Navbar";

/**
 * Playback naturally lags the schedule a little (stream load time, timer
 * jitter), so only treat deviations beyond this as the user seeking away
 * from the broadcast.
 */
const LIVE_DRIFT_TOLERANCE_MS = 10_000;

/**
 * Drift correction: the tune-in seek targets the live offset computed at
 * click time, but stream resolution and buffering delay actual playback by
 * a device-dependent few seconds, leaving every device behind live by a
 * different amount. While on air, playback that has drifted beyond this is
 * snapped back to the live position.
 */
const DRIFT_CORRECTION_MIN_MS = 4_000;
const DRIFT_CHECK_INTERVAL_MS = 5_000;
/** Don't bother re-syncing into the last moments of a slot. */
const SLOT_END_GUARD_MS = 8_000;

type Collective = ReturnType<typeof useCollectiveSelectStore.getState>["selected"];

function radioPool(episodes: EpisodeProjection[], collective: Collective) {
  const pool =
    collective === "all"
      ? episodes
      : episodes.filter((e) => e.collectiveSlug === collective);
  return pool.filter((e) => e.hasStreamableAudio);
}

/**
 * Orchestrates radio mode. Mount exactly once (EpisodesScreen); it owns the
 * slot-boundary timer and the store subscriptions that keep the player in
 * sync with the deterministic broadcast schedule.
 */
export function useRadio() {
  const { data: episodes } = useEpisodes();
  const selectedCollective = useCollectiveSelectStore((s) => s.selected);
  const isOn = useRadioStore((s) => s.isOn);
  const slot = useRadioStore((s) => s.slot);
  const waitingForBoundary = useRadioStore((s) => s.waitingForBoundary);
  const radioActions = useRadioStore((s) => s.actions);
  const playing = usePlayerStore((s) => s.playing);
  const playerActions = usePlayerActions();
  const { mutate } = usePlayEpisodeMutation();

  const tuneToNow = useCallback(() => {
    if (!episodes) return false;

    const next = radioSlotAt(
      radioPool(episodes, selectedCollective),
      radioStationKey(selectedCollective),
      Date.now(),
    );
    if (!next) return false;

    playerActions.loadEpisode(next.episodeId, next.offsetMs);
    radioActions.tuneIn({
      episodeId: next.episodeId,
      startsAtMs: next.startsAtMs,
      endsAtMs: next.endsAtMs,
    });
    mutate(next.episodeId, {
      onSuccess(data) {
        if (data) {
          playerActions.setCurrentEpisodeStreamUrls(next.episodeId, data);
        }
      },
    });
    return true;
  }, [episodes, selectedCollective, playerActions, radioActions, mutate]);

  // Unlike manual plays, tuning in doesn't open the episode sheet — the
  // mini player picking up the broadcast is the feedback.
  const tuneIn = useCallback(() => {
    event("Radio Tune In", { category: "Action" });
    tuneToNow();
  }, [tuneToNow]);

  // Leaves the current episode playing; only the "follow the broadcast"
  // behavior stops.
  const tuneOut = useCallback(() => {
    event("Radio Tune Out", { category: "Action" });
    radioActions.tuneOut();
  }, [radioActions]);

  // Advance to the next slot when this one's scheduled end passes. A user
  // pause suspends the radio (resume re-syncs below); audio that ran out
  // before the boundary (waitingForBoundary) still advances.
  useEffect(() => {
    if (!isOn || !slot) return;

    const advance = () => {
      const { playing } = usePlayerStore.getState();
      const { waitingForBoundary } = useRadioStore.getState();
      if (!playing && !waitingForBoundary) return;
      tuneToNow();
    };

    const msUntilEnd = slot.endsAtMs - Date.now();
    if (msUntilEnd <= 0) {
      advance();
      return;
    }
    // Land just inside the next slot so radioSlotAt resolves to it.
    const timer = window.setTimeout(advance, msUntilEnd + 500);

    // Background tabs throttle timers; catch up when the tab comes back.
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() >= slot.endsAtMs
      ) {
        advance();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isOn, slot, waitingForBoundary, tuneToNow]);

  // Keep playback pinned to the live position. Each seek costs a re-buffer,
  // so a correction raises the threshold for the next one (reset per slot):
  // fast connections converge in one hop, slow ones settle at an honest lag
  // instead of seeking in a loop.
  const driftThresholdRef = useRef(DRIFT_CORRECTION_MIN_MS);
  useEffect(() => {
    if (!isOn || !slot) return;
    driftThresholdRef.current = DRIFT_CORRECTION_MIN_MS;

    const interval = window.setInterval(() => {
      const player = usePlayerStore.getState();
      if (
        !player.playing ||
        player.loadingStatus !== "loaded" ||
        player.initialSeekMillis !== null ||
        player.currentEpisodeId !== slot.episodeId
      ) {
        return;
      }

      const liveOffsetMs = Date.now() - slot.startsAtMs;
      if (liveOffsetMs >= slot.endsAtMs - slot.startsAtMs - SLOT_END_GUARD_MS) {
        return;
      }

      const driftMs = liveOffsetMs - player.progress;
      if (Math.abs(driftMs) > driftThresholdRef.current) {
        driftThresholdRef.current = Math.min(
          driftThresholdRef.current * 2,
          60_000,
        );
        playerActions.setCuePosition(liveOffsetMs);
      }
    }, DRIFT_CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isOn, slot, playerActions]);

  // Radio semantics for resume: catch back up with the live broadcast
  // instead of continuing from where playback was paused.
  const prevPlayingRef = useRef(playing);
  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = playing;
    if (!isOn || !playing || wasPlaying || !episodes || !slot) return;

    const now = radioSlotAt(
      radioPool(episodes, selectedCollective),
      radioStationKey(selectedCollective),
      Date.now(),
    );
    if (!now) return;

    const { currentEpisodeId, progress } = usePlayerStore.getState();
    if (now.episodeId !== currentEpisodeId) {
      tuneToNow();
    } else if (Math.abs(progress - now.offsetMs) > LIVE_DRIFT_TOLERANCE_MS) {
      playerActions.setCuePosition(now.offsetMs);
    }
  }, [playing, isOn, episodes, selectedCollective, slot, tuneToNow, playerActions]);

  // Seeking away from the live position (scrubber, skip buttons, keyboard
  // shortcuts) is the user taking over: drop out of radio mode. Radio's own
  // seeks land at the live offset, inside the tolerance, so they don't trip
  // this.
  useEffect(() => {
    if (!isOn) return;

    const unsubscribe = usePlayerStore.subscribe((state, prevState) => {
      if (state.cuePosition === prevState.cuePosition) return;
      // An episode load is in flight (cue reset, then the initial seek to the
      // live offset); neither change is a user seek.
      if (state.initialSeekMillis !== null || prevState.initialSeekMillis !== null)
        return;

      const { isOn, slot } = useRadioStore.getState();
      if (!isOn || !slot || state.currentEpisodeId !== slot.episodeId) return;

      const liveOffsetMs = Date.now() - slot.startsAtMs;
      if (Math.abs(state.cuePosition - liveOffsetMs) > LIVE_DRIFT_TOLERANCE_MS) {
        useRadioStore.getState().actions.tuneOut();
      }
    });

    return unsubscribe;
  }, [isOn]);

  // Changing the collective while tuned in switches stations.
  const prevCollectiveRef = useRef(selectedCollective);
  useEffect(() => {
    const prevCollective = prevCollectiveRef.current;
    prevCollectiveRef.current = selectedCollective;
    if (!isOn || prevCollective === selectedCollective) return;
    tuneToNow();
  }, [selectedCollective, isOn, tuneToNow]);

  return { isOn, tuneIn, tuneOut };
}
