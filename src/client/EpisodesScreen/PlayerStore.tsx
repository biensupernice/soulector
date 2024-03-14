import create from "zustand";
import { clamp } from "../helpers";

type PlayerLoadingStatus = "loading" | "loaded" | "error";

export type StreamUrls = {
  http_mp3_128_url: string;
  hls_mp3_128_url: string;
  hls_opus_64_url: string;
  preview_mp3_128_url: string;
};

export type PlayerStore = {
  playing: boolean;
  volume: number;
  currentEpisodeId?: string;
  progress: number;
  episodeDuration: number;
  cuePosition: number;
  lastVol: number;
  loadingStatus: PlayerLoadingStatus;
  currentEpisodeStreamUrls: StreamUrls | null;
  actions: {
    play: (episodeId: string) => void;
    pause: () => void;
    resume: () => void;
    setProgress: (progress: number) => void;
    setVolume: (vol: number) => void;
    volumeUp: () => void;
    volumeDown: () => void;
    mute: () => void;
    unmute: () => void;
    toggleMute: () => void;
    setCuePosition: (cuePos: number) => void;
    forward: (secs: number) => void;
    rewind: (secs: number) => void;
    setEpisodeDuration: (duration: number) => void;
    loadEpisode: (episodeId: string) => void;
    setLoadingStatus: (status: PlayerLoadingStatus) => void;
    setCurrentEpisodeStreamUrls: (urls: StreamUrls) => void;
  };
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  playing: false,
  currentEpisodeId: undefined,
  volume: 100,
  lastVol: 100,
  progress: 0,
  episodeDuration: 0,
  cuePosition: 0,
  loadingStatus: "loading",
  currentEpisodeStreamUrls: null,
  actions: {
    setCurrentEpisodeStreamUrls(urls: StreamUrls) {
      set({
        currentEpisodeStreamUrls: urls,
      });
    },
    loadEpisode(episodeId: string) {
      const hasEpisodeLoaded = get().currentEpisodeId !== undefined;
      const isPlaying = get().playing;
      if (!hasEpisodeLoaded || !isPlaying) {
        set({
          // We can play the new episode since we were already playing audio
          currentEpisodeId: episodeId,
          progress: 0,
          cuePosition: 0,
        });
      } else {
        set({
          playing: true,
          currentEpisodeId: episodeId,
          progress: 0,
          cuePosition: 0,
        });
      }
    },
    setLoadingStatus: (status: PlayerLoadingStatus) =>
      set({ loadingStatus: status }),
    play(episodeId: string) {
      set({
        playing: true,
        currentEpisodeId: episodeId,
        progress: 0,
        cuePosition: 0,
      });
    },
    pause() {
      set({
        playing: false,
      });
    },
    resume() {
      set({
        playing: true,
      });
    },
    setProgress(progress: number) {
      set({
        progress: progress,
      });
    },
    setEpisodeDuration(duration: number) {
      set({
        episodeDuration: duration,
      });
    },
    setCuePosition(cuePos: number) {
      set({
        cuePosition: cuePos,
      });
    },
    forward(secs: number) {
      set({
        cuePosition: get().progress + secs * 1000,
      });
    },
    rewind(secs: number) {
      set({
        cuePosition: get().progress - secs * 1000,
      });
    },
    setVolume(vol: number) {
      set({
        volume: clamp(vol, 0, 100),
      });
    },
    volumeUp() {
      get().actions.setVolume(get().volume + 10);
    },
    volumeDown() {
      get().actions.setVolume(get().volume - 10);
    },
    mute() {
      set({
        lastVol: get().volume,
        volume: 0,
      });
    },
    unmute() {
      set({
        lastVol: 80,
        volume: get().lastVol,
      });
    },
    toggleMute() {
      const muted = get().volume <= 0;
      if (muted) {
        get().actions.unmute();
      } else {
        get().actions.mute();
      }
    },
  },
}));

// Values as hooks
export const usePlayerPlaying = () => usePlayerStore((s) => s.playing);
export const usePlayerVolume = () => usePlayerStore((s) => s.volume);
export const usePlayerProgress = () => usePlayerStore((s) => s.progress);
export const usePlayerCuePosition = () => usePlayerStore((s) => s.cuePosition);
export const usePlayerLoadingStatus = () =>
  usePlayerStore((s) => s.loadingStatus);
export const usePlayerEpisodeDuration = () =>
  usePlayerStore((s) => s.episodeDuration);

export const usePlayerCurrentEpisodeId = () =>
  usePlayerStore((s) => s.currentEpisodeId);

export const usePlayerEpisodeStreamUrls = () =>
  usePlayerStore((s) => s.currentEpisodeStreamUrls);

export const usePlayerActions = () => usePlayerStore((s) => s.actions);

export const usePlayerMuted = () => usePlayerStore((s) => s.volume <= 0);
export function usePlayerState() {
  const currentEpisodeId = usePlayerCurrentEpisodeId();
  const playing = usePlayerPlaying();

  if (!playing && currentEpisodeId) {
    return "paused";
  }

  if (!playing && !currentEpisodeId) {
    return "idle";
  }

  return "playing";
}
