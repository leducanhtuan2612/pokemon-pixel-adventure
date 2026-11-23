import { create } from "zustand";

type GameState = { ready: boolean; setReady: (ready: boolean) => void };
export const useGameStore = create<GameState>((set) => ({ ready: false, setReady: (ready) => set({ ready }) }));
