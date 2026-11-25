import { getMove, type StatusCondition } from "../data/moves";
import { getSpecies, type BaseStats, type GrowthRate, type Species } from "../data/species";
import { random } from "../services/RandomService";

export interface MoveSlot { id: string; pp: number; maxPp: number }

export interface PokemonInstance {
  uid: string;
  speciesId: string;
  nickname?: string;
  level: number;
  exp: number;
  ivs: BaseStats;
  hp: number;
  status: StatusCondition | null;
  /** Sleep turns remaining. */
  sleepTurns: number;
  moves: MoveSlot[];
  caughtBall?: string;
}

export type Stats = BaseStats;

export const MAX_LEVEL = 100;

export function expForLevel(growth: GrowthRate, n: number): number {
  if (n <= 1) return 0;
  switch (growth) {
    case "fast": return Math.floor((4 * n ** 3) / 5);
    case "mediumFast": return n ** 3;
    case "mediumSlow": return Math.max(0, Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140));
    case "slow": return Math.floor((5 * n ** 3) / 4);
  }
}

export function calcStats(mon: Pick<PokemonInstance, "speciesId" | "level" | "ivs">): Stats {
  const base = getSpecies(mon.speciesId).base, L = mon.level, iv = mon.ivs;
  const other = (b: number, i: number) => Math.floor(((2 * b + i) * L) / 100) + 5;
  return {
    hp: Math.floor(((2 * base.hp + iv.hp) * L) / 100) + L + 10,
    atk: other(base.atk, iv.atk), def: other(base.def, iv.def), spa: other(base.spa, iv.spa),
    spd: other(base.spd, iv.spd), spe: other(base.spe, iv.spe),
  };
}

export const maxHp = (mon: PokemonInstance) => calcStats(mon).hp;
export const displayName = (mon: PokemonInstance) => mon.nickname || getSpecies(mon.speciesId).name;

/** Last four moves learned at or below `level` (Gen 3 wild/trainer default). */
export function defaultMoves(species: Species, level: number): MoveSlot[] {
  const ids: string[] = [];
  for (const [lv, id] of species.learnset) {
    if (lv > level) continue;
    if (ids.includes(id)) continue;
    ids.push(id);
  }
  return ids.slice(-4).map(slot);
}

export function slot(id: string): MoveSlot {
  const pp = getMove(id).pp;
  return { id, pp, maxPp: pp };
}

let uidCounter = 0;
export function createPokemon(speciesId: string, level: number, overrides: Partial<PokemonInstance> = {}): PokemonInstance {
  const species = getSpecies(speciesId);
  const ivs = { hp: random.int(0, 31), atk: random.int(0, 31), def: random.int(0, 31), spa: random.int(0, 31), spd: random.int(0, 31), spe: random.int(0, 31) };
  const mon: PokemonInstance = {
    uid: `${Date.now().toString(36)}-${(uidCounter++).toString(36)}-${random.int(0, 1e6).toString(36)}`,
    speciesId: species.id, level, exp: expForLevel(species.growth, level), ivs, hp: 1,
    status: null, sleepTurns: 0, moves: defaultMoves(species, level), ...overrides,
  };
  mon.hp = maxHp(mon);
  return mon;
}

/** Moves a species learns exactly at `level`. */
export function movesLearnedAt(speciesId: string, level: number): string[] {
  return getSpecies(speciesId).learnset.filter(([lv]) => lv === level).map(([, id]) => id);
}

export interface LevelUpResult { level: number; learned: string[]; pending: string[] }

/**
 * Adds experience; handles level ups and auto-learning when a slot is free.
 * Moves that would need a replacement are returned in `pending` for the UI to ask about.
 */
export function gainExp(mon: PokemonInstance, amount: number): LevelUpResult[] {
  const species = getSpecies(mon.speciesId);
  const results: LevelUpResult[] = [];
  mon.exp += amount;
  while (mon.level < MAX_LEVEL && mon.exp >= expForLevel(species.growth, mon.level + 1)) {
    const before = maxHp(mon);
    mon.level++;
    mon.hp = Math.max(0, mon.hp + (maxHp(mon) - before));
    const learned: string[] = [], pending: string[] = [];
    for (const id of movesLearnedAt(mon.speciesId, mon.level)) {
      if (mon.moves.some((m) => m.id === id)) continue;
      if (mon.moves.length < 4) { mon.moves.push(slot(id)); learned.push(id); }
      else pending.push(id);
    }
    results.push({ level: mon.level, learned, pending });
  }
  return results;
}

export function levelEvolution(mon: PokemonInstance): string | null {
  const evo = getSpecies(mon.speciesId).evolutions?.find((e) => e.kind === "level" && mon.level >= e.level);
  return evo ? evo.into : null;
}

export function itemEvolution(mon: PokemonInstance, itemId: string): string | null {
  const evo = getSpecies(mon.speciesId).evolutions?.find((e) => e.kind === "item" && e.item === itemId);
  return evo ? evo.into : null;
}

/** Changes species in place, keeping HP damage proportional; returns newly learnable moves at this level. */
export function evolve(mon: PokemonInstance, into: string): { learned: string[]; pending: string[] } {
  const lost = maxHp(mon) - mon.hp;
  mon.speciesId = into;
  mon.hp = Math.max(1, maxHp(mon) - lost);
  const learned: string[] = [], pending: string[] = [];
  for (const id of movesLearnedAt(into, mon.level)) {
    if (mon.moves.some((m) => m.id === id)) continue;
    if (mon.moves.length < 4) { mon.moves.push(slot(id)); learned.push(id); } else pending.push(id);
  }
  return { learned, pending };
}

export function healPokemon(mon: PokemonInstance) {
  mon.hp = maxHp(mon);
  mon.status = null;
  mon.sleepTurns = 0;
  mon.moves.forEach((m) => (m.pp = m.maxPp));
}

export const STATUS_LABEL: Record<StatusCondition, string> = { brn: "BRN", psn: "PSN", par: "PAR", slp: "SLP", frz: "FRZ" };
export const STATUS_COLOR: Record<StatusCondition, string> = { brn: "#e05830", psn: "#a040a0", par: "#d8b020", slp: "#8888a0", frz: "#58b8e0" };
