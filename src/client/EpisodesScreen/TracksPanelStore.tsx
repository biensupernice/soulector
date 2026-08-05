import { create } from "zustand";

/** The record a crossing rode in on, and where it sits in the set it landed. */
export type Landing = { episodeId: string; order: number };

interface TracksPanelStore {
  /** The episode whose desktop tracklist is expanded, if any. */
  openEpisodeId: string | null;
  /** Set by a crossing so the set it lands in can open on the right record. */
  landedOn: Landing | null;
  actions: {
    toggle: (episodeId: string) => void;
    open: (episodeId: string) => void;
    close: () => void;
    land: (landing: Landing) => void;
  };
}

/**
 * Which episode row has its tracklist open on desktop.
 *
 * This lives outside the row because moving sideways has to be able to open
 * the panel of the set it lands in, and a row that isn't playing yet hasn't
 * rendered to be asked.
 */
export const useTracksPanelStore = create<TracksPanelStore>()((set) => ({
  openEpisodeId: null,
  landedOn: null,
  actions: {
    // Opening a panel by hand is not arriving somewhere, so it drops any
    // landing the crossing left behind.
    toggle: (episodeId) =>
      set((state) => ({
        openEpisodeId: state.openEpisodeId === episodeId ? null : episodeId,
        landedOn: null,
      })),
    open: (episodeId) => set({ openEpisodeId: episodeId, landedOn: null }),
    close: () => set({ openEpisodeId: null, landedOn: null }),
    land: (landing) =>
      set({ openEpisodeId: landing.episodeId, landedOn: landing }),
  },
}));

export const useTracksPanelActions = () =>
  useTracksPanelStore((s) => s.actions);

export const useIsTracksPanelOpen = (episodeId: string) =>
  useTracksPanelStore((s) => s.openEpisodeId === episodeId);
