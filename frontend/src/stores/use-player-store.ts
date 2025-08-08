import { create } from "zustand";

interface PlayerTrack {
  id: string;
  title: string | null;
  url: string | null;
  artwork?: string | null;
  prompt: string | null;
  createdByUserName: string | null;
}

interface PlayerState {
  track: PlayerTrack | null;
  setTrack: (track: PlayerTrack) => void;
  // Autoplay request marker increments on user-initiated play intent
  autoplayRequestId: number;
  requestAutoplay: () => void;
  // Shared analyser from currently playing audio (if available)
  externalAnalyser: AnalyserNode | null;
  setExternalAnalyser: (node: AnalyserNode | null) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  track: null,
  setTrack: (track) => set({ track }),
  autoplayRequestId: 0,
  requestAutoplay: () => set((s) => ({ autoplayRequestId: s.autoplayRequestId + 1 })),
  externalAnalyser: null,
  setExternalAnalyser: (node) => set({ externalAnalyser: node }),
}));
