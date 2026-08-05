import { create } from "zustand";

interface TracksPanelStore {
  /** The episode whose desktop tracklist is expanded, if any. */
  openEpisodeId: string | null;
  actions: {
    toggle: (episodeId: string) => void;
    open: (episodeId: string) => void;
    close: () => void;
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
  actions: {
    toggle: (episodeId) =>
      set((state) => ({
        openEpisodeId: state.openEpisodeId === episodeId ? null : episodeId,
      })),
    open: (episodeId) => set({ openEpisodeId: episodeId }),
    close: () => set({ openEpisodeId: null }),
  },
}));

export const useTracksPanelActions = () =>
  useTracksPanelStore((s) => s.actions);

export const useIsTracksPanelOpen = (episodeId: string) =>
  useTracksPanelStore((s) => s.openEpisodeId === episodeId);
