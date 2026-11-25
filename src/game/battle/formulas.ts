import type { MoveData, Stat } from "../data/moves";
import { getSpecies } from "../data/species";
import { categoryOf, effectiveness } from "../data/types";
import { calcStats, type PokemonInstance } from "../core/pokemon";
import type { RandomService } from "../services/RandomService";

export type Stages = Record<Stat, number>;
export const freshStages = (): Stages => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 });

export function stageMultiplier(stage: number) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}
export function accuracyMultiplier(stage: number) {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}

export function effectiveSpeed(mon: PokemonInstance, stages: Stages) {
  let spe = Math.floor(calcStats(mon).spe * stageMultiplier(stages.spe));
  if (mon.status === "par") spe = Math.floor(spe / 4);
  return spe;
}

export interface DamageResult { damage: number; crit: boolean; eff: number }

/** Gen 3 damage formula (no abilities/items/weather). */
export function calcDamage(
  rng: RandomService, move: MoveData,
  attacker: PokemonInstance, aStages: Stages,
  defender: PokemonInstance, dStages: Stages,
): DamageResult {
  const atkTypes = getSpecies(attacker.speciesId).types, defTypes = getSpecies(defender.speciesId).types;
  const eff = move.id === "struggle" ? 1 : effectiveness(move.type, defTypes);
  if (eff === 0) return { damage: 0, crit: false, eff };
  const physical = categoryOf(move.type) === "physical";
  const a = calcStats(attacker), d = calcStats(defender);
  const crit = rng.chance(move.highCrit ? 1 / 8 : 1 / 16);
  // Critical hits ignore the attacker's drops and the defender's boosts.
  const aStage = physical ? aStages.atk : aStages.spa, dStage = physical ? dStages.def : dStages.spd;
  let A = Math.floor((physical ? a.atk : a.spa) * stageMultiplier(crit ? Math.max(0, aStage) : aStage));
  const D = Math.max(1, Math.floor((physical ? d.def : d.spd) * stageMultiplier(crit ? Math.min(0, dStage) : dStage)));
  if (physical && attacker.status === "brn") A = Math.floor(A / 2);
  let dmg = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5) + 2) * move.power * A / D) / 50) + 2;
  if (crit) dmg *= 2;
  if (move.id !== "struggle" && atkTypes.includes(move.type)) dmg = Math.floor(dmg * 1.5);
  dmg = Math.floor(dmg * eff);
  dmg = Math.floor((dmg * rng.int(85, 100)) / 100);
  return { damage: Math.max(1, dmg), crit, eff };
}

/** Gen 3 catch formula; returns number of shakes (4 = caught). */
export function catchShakes(rng: RandomService, mon: PokemonInstance, ballMultiplier: number): number {
  const M = calcStats(mon).hp, H = Math.max(1, mon.hp);
  const rate = getSpecies(mon.speciesId).catchRate;
  const statusMult = mon.status === "slp" ? 2 : mon.status ? 1.5 : 1;
  const a = Math.floor((Math.floor(((3 * M - 2 * H) * rate * ballMultiplier) / (3 * M))) * statusMult);
  if (a >= 255) return 4;
  if (a <= 0) return 0;
  const b = Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / a))))));
  let shakes = 0;
  while (shakes < 4 && rng.int(0, 65535) < b) shakes++;
  return shakes;
}

/** Gen 3 experience: base * level / 7, ×1.5 for trainer battles, split among participants. */
export function expYield(foe: PokemonInstance, trainer: boolean, participants: number) {
  const base = Math.floor((getSpecies(foe.speciesId).baseExp * foe.level) / 7);
  return Math.max(1, Math.floor(Math.floor(base * (trainer ? 1.5 : 1)) / Math.max(1, participants)));
}
