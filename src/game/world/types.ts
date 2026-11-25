export type Point = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";

export const DIR_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Look ids map to palettes in pixelArt.ts — one character template, many outfits. */
export type CharacterLook = "player" | "nurse" | "ranger" | "bugCatcher" | "lass" | "hiker" | "guardian" | "clerk";

export type NpcRole = "healer" | "guide" | "trainer" | "boss" | "mart";

export interface TeamMember { speciesId: string; level: number }

export interface NpcDef {
  id: string;
  name: string;
  x: number;
  y: number;
  facing: Direction;
  look: CharacterLook;
  role: NpcRole;
  /** Pages shown before battle / on talk. */
  dialog: string[];
  /** Pages shown when the trainer has already been beaten. */
  defeatedDialog?: string[];
  team?: TeamMember[];
  /** Trainer ids that must be defeated before this NPC accepts a battle. */
  requires?: string[];
  lockedDialog?: string[];
  /** Where the NPC steps to once defeated (e.g. a guardian clearing the road). */
  moveToWhenDefeated?: Point;
  /** Base prize money (× level of the last Pokémon). */
  prize?: number;
  /** This NPC hands out the starter Pokémon. */
  givesStarter?: boolean;
  /** Badge id awarded on defeat. */
  badge?: string;
}

export interface BuildingDef {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: number;
  wall: number;
  door: Point;
  doorText: string[];
  /** Pixel-font sign on the roof edge. */
  plaque?: string;
  chimney?: boolean;
}

export interface SignDef { x: number; y: number; text: string[] }

export interface ExitDef {
  x: number;
  y: number;
  /** Id of the area this exit unlocks / leads to. */
  to: string;
  toName: string;
  requiresBadge: boolean;
  lockedText: string[];
  /** Tile the player is pushed back to when the exit cannot be used yet. */
  returnTo: Point;
}

export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export interface EncounterEntry {
  speciesId: string;
  weight: number;
  minLevel: number;
  maxLevel: number;
  rarity: Rarity;
}

export interface EncounterTable {
  /** Chance per step on an encounter tile. */
  rate: number;
  entries: EncounterEntry[];
}

export interface MapDefinition {
  id: string;
  name: string;
  theme: string;
  /** One string per row; each char is a tile key from tiles.ts. */
  layout: string[];
  spawn: Point;
  /** Where the player wakes up after the whole team faints. */
  healSpot: Point;
  buildings: BuildingDef[];
  npcs: NpcDef[];
  signs: SignDef[];
  exits: ExitDef[];
  encounters: EncounterTable;
  intro: string[];
}
