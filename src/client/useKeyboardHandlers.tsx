import {
  usePlayerActions,
  usePlayerPlaying,
  usePlayerEpisodeDuration,
  usePlayerCurrentEpisodeId,
  usePlayerProgress,
  usePlayerSkipInterval,
} from "./EpisodesScreen/PlayerStore";
import { useEffect, useMemo } from "react";
import {
  isWritableElement,
  isInputLike,
  KEYS,
  isArrowKey,
  EVENT,
} from "./helpers";
import { useNavbarStore } from "./EpisodesScreen/Navbar";
import { useEpisodeTracks } from "./EpisodesScreen/EpisodeModalSheet";
import { EpisodeTrackProjection } from "@/server/router";

// Tracks with a known timestamp, sorted so we can walk forward/back through
// them regardless of the order they were stored in.
function timedTracksSorted(
  tracks: EpisodeTrackProjection[] | undefined,
): (EpisodeTrackProjection & { timestamp: number })[] {
  return (tracks ?? [])
    .filter(
      (t): t is EpisodeTrackProjection & { timestamp: number } =>
        typeof t.timestamp === "number",
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

export interface KeyboardAction {
  perform: Function;
  keyPriority?: number;
  keyTest: (event: globalThis.KeyboardEvent) => boolean;
}

export type KeyboarActionsMap = {
  [key: string]: KeyboardAction;
};

export function useShortcutHandlers() {
  const playerActions = usePlayerActions();
  const playing = usePlayerPlaying();
  const episodeDuration = usePlayerEpisodeDuration();
  const progress = usePlayerProgress();
  const skipInterval = usePlayerSkipInterval();
  const currentEpisodeId = usePlayerCurrentEpisodeId();
  const openSearch = useNavbarStore((state) => state.openSearch);

  const { data: tracks } = useEpisodeTracks(
    currentEpisodeId ?? "",
    Boolean(currentEpisodeId),
  );

  const togglePlay = useMemo(() => {
    return playing ? playerActions.pause : playerActions.resume;
  }, [playing, playerActions]);

  // Shift+forward: jump to the next track when the episode is tracklisted,
  // otherwise fast-forward by an incrementing amount of time.
  function skipForward() {
    const progressSecs = progress / 1000;
    const timed = timedTracksSorted(tracks);
    const nextTrack = timed.find((t) => t.timestamp > progressSecs + 0.5);
    if (nextTrack) {
      playerActions.setCuePosition(nextTrack.timestamp * 1000);
    } else {
      playerActions.skipForwardIncrementing();
    }
  }

  // Shift+back: jump to the previous track (or restart the current one when
  // we're a few seconds into it), otherwise rewind by an incrementing amount.
  function skipBackward() {
    const progressSecs = progress / 1000;
    const timed = timedTracksSorted(tracks);

    let currentIdx = -1;
    for (let i = 0; i < timed.length; i++) {
      if (timed[i].timestamp <= progressSecs) {
        currentIdx = i;
      }
    }

    if (currentIdx === -1) {
      playerActions.skipBackwardIncrementing();
      return;
    }

    const RESTART_THRESHOLD_SECS = 3;
    const intoCurrent = progressSecs - timed[currentIdx].timestamp;
    const target =
      intoCurrent > RESTART_THRESHOLD_SECS
        ? timed[currentIdx]
        : (timed[currentIdx - 1] ?? timed[0]);
    playerActions.setCuePosition(target.timestamp * 1000);
  }

  const keyboardActions: KeyboarActionsMap = {
    VOLUME_UP: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.ARROW_UP && event.shiftKey;
      },
      perform: playerActions.volumeUp,
    },
    VOLUME_DOWN: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.ARROW_DOWN && event.shiftKey;
      },
      perform: playerActions.volumeDown,
    },
    TOGGLE_MUTE: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.keyCode === KEYS.M_KEY_CODE;
      },
      perform: playerActions.toggleMute,
    },
    TOGGLE_PLAY: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.SPACE;
      },
      perform: togglePlay,
    },
    FORWARD_SKIP: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.ARROW_RIGHT && !event.shiftKey;
      },
      perform: () => playerActions.forward(skipInterval),
    },
    REWIND_SKIP: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.ARROW_LEFT && !event.shiftKey;
      },
      perform: () => playerActions.rewind(skipInterval),
    },
    SHIFT_FORWARD: {
      // Higher priority so it wins over any plain ArrowRight handler.
      keyPriority: 1,
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.ARROW_RIGHT && event.shiftKey;
      },
      perform: skipForward,
    },
    SHIFT_REWIND: {
      keyPriority: 1,
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.ARROW_LEFT && event.shiftKey;
      },
      perform: skipBackward,
    },
    OPEN_SEARCH: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event[KEYS.CTRL_OR_CMD] && event.keyCode === KEYS.F_KEY_CODE;
      },
      perform: openSearch,
    },
    ZERO_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.ZERO_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(0);
      },
    },
    TEN_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.ONE_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.1);
      },
    },
    TWENTY_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.TWO_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.2);
      },
    },
    THIRTY_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.THREE_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.3);
      },
    },
    FOURTY_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.FOUR_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.4);
      },
    },
    FIFTY_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.FIVE_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.5);
      },
    },
    SIXTY_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.SIX_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.6);
      },
    },
    SEVENTY_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.SEVEN_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.7);
      },
    },
    EIGHTY_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.EIGHT_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.8);
      },
    },
    NINETY_PERCENT: {
      keyTest: (event: globalThis.KeyboardEvent) => {
        return event.key === KEYS.NINE_KEY;
      },
      perform: () => {
        playerActions.setCuePosition(episodeDuration * 0.9);
      },
    },
  };

  function handleKeyDown(event: globalThis.KeyboardEvent) {
    const data = Object.values(keyboardActions)
      .sort((a, b) => (b.keyPriority || 0) - (a.keyPriority || 0))
      .filter((action) => action.keyTest(event));

    if (data.length === 0) {
      return false;
    }

    event.preventDefault();

    data[0].perform();
    return true;
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      // Ignore events in inputs
      if (
        (isWritableElement(event.target) && event.key !== KEYS.ESCAPE) ||
        // case: using arrows to move between buttons
        (isArrowKey(event.key) && isInputLike(event.target))
      ) {
        return;
      }

      if (event.key === KEYS.QUESTION_MARK) {
        // TODO: Open keyboard shortcuts dialog
      }

      if (handleKeyDown(event)) {
        return;
      }
    }

    document.addEventListener(EVENT.KEYDOWN, onKeyDown, false);

    return () => {
      document.removeEventListener(EVENT.KEYDOWN, onKeyDown, false);
    };
  });
}
