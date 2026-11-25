import generated from "./generated/moves.json";
import type { PokemonType } from "./types";

export type Stat = "atk" | "def" | "spa" | "spd" | "spe" | "acc" | "eva";
export type StatusCondition = "brn" | "psn" | "par" | "slp" | "frz";

export interface StatChange { stat: Stat; stages: number; target: "self" | "foe" }

/** Gen 3 move, converted from @pkmn/dex by scripts/gen-data.mjs. */
export interface MoveData {
  id: string;
  name: string;
  type: PokemonType;
  /** 0 = status move. */
  power: number;
  /** null = never misses. */
  accuracy: number | null;
  pp: number;
  priority?: number;
  status?: StatusCondition;
  stats?: StatChange[];
  /** % chance for secondary effects of damaging moves. Status moves always apply. */
  chance?: number;
  flinch?: number;
  confuse?: boolean;
  drain?: number;
  recoil?: number;
  highCrit?: boolean;
  multiHit?: [number, number];
  fixedDamage?: number | "level" | "half";
  ohko?: boolean;
  heal?: number;
  rest?: boolean;
  leechSeed?: boolean;
  screen?: "reflect" | "lightscreen";
  haze?: boolean;
  protect?: boolean;
  selfDestruct?: boolean;
  focus?: boolean;
  requiresSleep?: boolean;
  firstTurn?: boolean;
  lowHpPower?: boolean;
  flee?: boolean;
  splash?: boolean;
  unsupported?: boolean;
  desc: string;
}

export const MOVES = generated as unknown as Record<string, MoveData>;

/** Used when every move is out of PP. */
export const STRUGGLE: MoveData = { id: "struggle", name: "Struggle", type: "Normal", power: 50, accuracy: null, pp: 1, recoil: 0.25, desc: "Đòn liều mạng khi hết PP." };

/** Accepts both Showdown ids (`quickattack`) and older hyphenated ids (`quick-attack`). */
export const normalizeMoveId = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, "");
export const getMove = (id: string): MoveData => MOVES[normalizeMoveId(id)] ?? MOVES.tackle;
