import { create } from "zustand";

export type RadioSlotState = {
  episodeId: string;
  startsAtMs: number;
  endsAtMs: number;
};

export type RadioStore = {
  isOn: boolean;
  /** The schedule slot the radio is currently tuned to, while on. */
  slot: RadioSlotState | null;
  /**
   * Set when the audio finished before the scheduled slot boundary (stored
   * durations can slightly overshoot the real audio). The boundary timer
   * treats this as "still listening" rather than a user pause, so the
   * broadcast advances at the boundary instead of stalling.
   */
  waitingForBoundary: boolean;
  actions: {
    tuneIn: (slot: RadioSlotState) => void;
    tuneOut: () => void;
    markPlaybackEnded: () => void;
  };
};

export const useRadioStore = create<RadioStore>()((set) => ({
  isOn: false,
  slot: null,
  waitingForBoundary: false,
  actions: {
    tuneIn: (slot) => set({ isOn: true, slot, waitingForBoundary: false }),
    tuneOut: () => set({ isOn: false, slot: null, waitingForBoundary: false }),
    markPlaybackEnded: () => set({ waitingForBoundary: true }),
  },
}));

export const useRadioOn = () => useRadioStore((s) => s.isOn);
export const useRadioActions = () => useRadioStore((s) => s.actions);
