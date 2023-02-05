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
  currentTrackId?: string;
  progress: number;
  trackDuration: number;
  cuePosition: number;
  lastVol: number;
  loadingStatus: PlayerLoadingStatus;
  currentTrackStreamUrls: StreamUrls | null;
  actions: {
    play: (trackId: string) => void;
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
    setTrackDuration: (duration: number) => void;
    loadTrack: (trackId: string) => void;
    setLoadingStatus: (status: PlayerLoadingStatus) => void;
    setCurrentTrackStreamUrls: (urls: StreamUrls) => void;
  };
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  playing: false,
  currentTrackId: undefined,
  volume: 100,
  lastVol: 100,
  progress: 0,
  trackDuration: 0,
  cuePosition: 0,
  loadingStatus: "loading",
  currentTrackStreamUrls: null,
  actions: {
    setCurrentTrackStreamUrls(urls: StreamUrls) {
      set({
        currentTrackStreamUrls: urls,
      });
    },
    loadTrack(trackId: string) {
      const hasTrackLoaded = get().currentTrackId !== undefined;
      const isPlaying = get().playing;
      if (!hasTrackLoaded || !isPlaying) {
        set({
          // We can play the new track since we were already playing audio
          currentTrackId: trackId,
          progress: 0,
          cuePosition: 0,
        });
      } else {
        set({
          playing: true,
          currentTrackId: trackId,
          progress: 0,
          cuePosition: 0,
        });
      }
    },
    setLoadingStatus: (status: PlayerLoadingStatus) =>
      set({ loadingStatus: status }),
    play(trackId: string) {
      set({
        playing: true,
        currentTrackId: trackId,
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
    setTrackDuration(duration: number) {
      set({
        trackDuration: duration,
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
export const usePlayerTrackDuration = () =>
  usePlayerStore((s) => s.trackDuration);

export const usePlayerCurrentTrackId = () =>
  usePlayerStore((s) => s.currentTrackId);

export const usePlayerTrackStreamUrls = () =>
  usePlayerStore((s) => s.currentTrackStreamUrls);

export const usePlayerActions = () => usePlayerStore((s) => s.actions);

export const usePlayerMuted = () => usePlayerStore((s) => s.volume <= 0);
export function usePlayerState() {
  const currentTrackId = usePlayerCurrentTrackId();
  const playing = usePlayerPlaying();

  if (!playing && currentTrackId) {
    return "paused";
  }

  if (!playing && !currentTrackId) {
    return "idle";
  }

  return "playing";
}
