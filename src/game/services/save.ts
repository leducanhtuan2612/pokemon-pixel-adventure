import { makeCreature, type Creature } from "../data/pokemon";
import { START_MAP_ID } from "../data/maps";

export type SaveData = {
  version: number;
  mapId: string;
  party: Creature[];
  box: Creature[];
  balls: number;
  potions: number;
  defeated: string[];
  badge: boolean;
  unlockedAreas: string[];
  steps: number;
  position: { x: number; y: number } | null;
};

const KEY = "pixel-adventure-save-v1";
const VERSION = 2;

export function newGame(): SaveData {
  return {
    version: VERSION, mapId: START_MAP_ID, party: [makeCreature("bulbasaur", 5)], box: [], balls: 10, potions: 5,
    defeated: [], badge: false, unlockedAreas: [START_MAP_ID], steps: 0, position: null,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData>;
      if (Array.isArray(d.party) && d.party.length) {
        const fresh = newGame();
        const sameLayout = d.version === VERSION;
        return {
          ...fresh, ...d,
          version: VERSION,
          mapId: d.mapId ?? START_MAP_ID,
          box: Array.isArray(d.box) ? d.box : [],
          defeated: Array.isArray(d.defeated) ? d.defeated : [],
          unlockedAreas: Array.isArray(d.unlockedAreas) ? d.unlockedAreas : fresh.unlockedAreas,
          // v1 positions refer to the old hand-drawn map; start those players at the spawn point.
          position: sameLayout ? d.position ?? null : null,
        };
      }
    }
  } catch { /* corrupted save: fall back to a fresh game */ }
  return newGame();
}

export function saveGame(data: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage may be disabled */ }
}
