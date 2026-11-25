import { create } from "zustand";
import { session } from "../game/core/GameSession";

export type Panel = "menu" | "party" | "bag" | "dex" | "mart" | "starter" | "box";

type GameState = {
  ready: boolean;
  /** Bumped whenever the session changes so React re-renders. */
  version: number;
  panel: Panel | null;
  /** Time a panel last closed; Phaser ignores the same key press that closed it. */
  closedAt: number;
  notice: string | null;
  setReady: (ready: boolean) => void;
  open: (panel: Panel) => void;
  close: () => void;
  notify: (msg: string | null) => void;
};

export const useGameStore = create<GameState>((set) => ({
  ready: false,
  version: 0,
  panel: null,
  closedAt: 0,
  notice: null,
  setReady: (ready) => set({ ready }),
  open: (panel) => set({ panel }),
  close: () => set({ panel: null, closedAt: performance.now() }),
  notify: (notice) => set({ notice }),
}));

session.on(() => useGameStore.setState((s) => ({ version: s.version + 1 })));

/** Phaser asks this before reading input so React menus block movement. */
export const isUiOpen = () => {
  const s = useGameStore.getState();
  return s.panel !== null || performance.now() - s.closedAt < 250;
};
