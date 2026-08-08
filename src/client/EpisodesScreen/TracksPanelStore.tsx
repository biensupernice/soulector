import { create } from "zustand";

/** The record a crossing rode in on, and where it sits in the set it landed. */
export type Landing = { episodeId: string; order: number };

/** One set along a dive, and the record it was entered on. */
export type Hop = Landing & { name: string; timestamp?: number };

interface TracksPanelStore {
  /** The episode whose desktop tracklist is expanded, if any. */
  openEpisodeId: string | null;
  /** Set by a crossing so the set it lands in can open on the right record. */
  landedOn: Landing | null;
  /**
   * The path taken, oldest first. Empty until the first crossing; the set the
   * dive started from is seeded in as its first step.
   */
  trail: Hop[];
  actions: {
    toggle: (episodeId: string) => void;
    open: (episodeId: string) => void;
    close: () => void;
    land: (target: Hop, from: Hop) => void;
    /** Jump back to a step already taken, dropping everything after it. */
    retraceTo: (index: number) => Hop | null;
    clearTrail: () => void;
  };
}

/**
 * Which episode row has its tracklist open on desktop.
 *
 * This lives outside the row because moving sideways has to be able to open
 * the panel of the set it lands in, and a row that isn't playing yet hasn't
 * rendered to be asked.
 */
export const useTracksPanelStore = create<TracksPanelStore>()((set, get) => ({
  openEpisodeId: null,
  landedOn: null,
  trail: [],
  actions: {
    // Opening a panel by hand is not arriving somewhere: it drops the landing
    // and ends whatever dive was in progress.
    toggle: (episodeId) =>
      set((state) => ({
        openEpisodeId: state.openEpisodeId === episodeId ? null : episodeId,
        landedOn: null,
        trail: [],
      })),
    open: (episodeId) =>
      set({ openEpisodeId: episodeId, landedOn: null, trail: [] }),
    close: () => set({ openEpisodeId: null, landedOn: null, trail: [] }),
    land: (target, from) =>
      set((state) => ({
        openEpisodeId: target.episodeId,
        landedOn: target,
        // The set being left is the dive's first step, so seed it in when the
        // path is still empty.
        trail:
          state.trail.length === 0 ? [from, target] : [...state.trail, target],
      })),
    retraceTo: (index) => {
      const { trail } = get();
      const step = trail[index];
      if (!step) return null;
      set({
        openEpisodeId: step.episodeId,
        landedOn: step,
        trail: trail.slice(0, index + 1),
      });
      return step;
    },
    clearTrail: () => set({ trail: [] }),
  },
}));

export const useTracksPanelActions = () =>
  useTracksPanelStore((s) => s.actions);

export const useIsTracksPanelOpen = (episodeId: string) =>
  useTracksPanelStore((s) => s.openEpisodeId === episodeId);
