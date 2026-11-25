import { getMove } from "../data/moves";
import { getSpecies } from "../data/species";
import { effectiveness } from "../data/types";
import { maxHp, type PokemonInstance } from "../core/pokemon";
import type { RandomService } from "../services/RandomService";
import type { Stages } from "./formulas";

/** Returns the index of the move to use, or -1 for Struggle. */
export function chooseMove(rng: RandomService, self: PokemonInstance, selfStages: Stages, target: PokemonInstance, smart: boolean): number {
  const usable = self.moves.map((m, i) => ({ m, i })).filter(({ m }) => m.pp > 0);
  if (!usable.length) return -1;
  if (!smart) return usable[rng.int(0, usable.length - 1)].i;

  const myTypes = getSpecies(self.speciesId).types, theirTypes = getSpecies(target.speciesId).types;
  let best = usable[0].i, bestScore = -Infinity;
  for (const { m, i } of usable) {
    const move = getMove(m.id);
    let score: number;
    if (move.power > 0) {
      const eff = effectiveness(move.type, theirTypes);
      score = move.power * eff * (myTypes.includes(move.type) ? 1.5 : 1) * ((move.accuracy ?? 100) / 100);
    } else if (move.status) {
      score = target.status ? -1 : 45;
      if (move.status === "par" && effectiveness(move.type, theirTypes) === 0) score = -1;
    } else if (move.rest) {
      score = self.hp < maxHp(self) * 0.35 && self.status !== "slp" ? 80 : -1;
    } else if (move.stats) {
      const selfBoost = move.stats.find((s) => s.target === "self");
      const stage = selfBoost ? selfStages[selfBoost.stat] : 0;
      score = stage >= 2 ? -1 : 25;
    } else score = 1;
    score *= 0.85 + rng.float() * 0.3;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
