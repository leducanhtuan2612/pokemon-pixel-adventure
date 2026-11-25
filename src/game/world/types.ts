export type Point = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";

export const DIR_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Look ids map to palettes in pixelArt.ts — one character template, many outfits. */
export type CharacterLook = "player" | "nurse" | "ranger" | "bugCatcher" | "lass" | "hiker" | "guardian" | "clerk"
  | "mom" | "professor" | "farmer" | "kid" | "oldman" | "girl" | "youngster" | "vendor";

export type NpcRole = "healer" | "guide" | "trainer" | "boss" | "mart" | "villager" | "critter";

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
  /** Wanders randomly within this many tiles of its spawn. */
  wander?: number;
  /** Trainers spot the player this many tiles ahead in their facing direction. */
  sight?: number;
  /** For role "critter": the wild Pokémon shown walking around. */
  speciesId?: string;
  /** Item given once after talking (quest rewards etc.). */
  gift?: { item: string; qty: number; flag: string; requiresCaught?: number; text: string[]; notYet?: string[] };
}

export interface MapItemDef { id: string; x: number; y: number; item: string; qty: number; hidden?: boolean }

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
  style?: "house" | "windmill" | "barn" | "greenhouse" | "shop";
}

export interface SignDef { x: number; y: number; text: string[] }

export interface ExitDef {
  x: number;
  y: number;
  /** Id of the area this exit unlocks / leads to. */
  to: string;
  toName: string;
  requiresBadge: boolean;
  /** Not reachable yet (next map under construction). */
  closed?: boolean;
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
  items?: MapItemDef[];
  intro: string[];
}
