import { getMove } from "../data/moves";
import { getSpecies } from "../data/species";
import { effectiveness } from "../data/types";
import { maxHp, type PokemonInstance } from "../core/pokemon";
import type { RandomService } from "../services/RandomService";
import type { Stages } from "./formulas";

/** Returns the index of the move to use, or -1 for Struggle. Wild Pokémon pick randomly; trainers score moves. */
export function chooseMove(rng: RandomService, self: PokemonInstance, selfStages: Stages, target: PokemonInstance, smart: boolean): number {
  const usable = self.moves.map((m, i) => ({ m, i })).filter(({ m }) => m.pp > 0);
  if (!usable.length) return -1;
  if (!smart) return usable[rng.int(0, usable.length - 1)].i;

  const myTypes = getSpecies(self.speciesId).types, theirTypes = getSpecies(target.speciesId).types;
  const hpRatio = self.hp / maxHp(self);
  let best = usable[0].i, bestScore = -Infinity;
  for (const { m, i } of usable) {
    const move = getMove(m.id);
    const eff = effectiveness(move.type, theirTypes);
    let score = 1;
    if (move.power > 0) {
      const hits = move.multiHit ? 3 : 1;
      score = move.power * hits * eff * (myTypes.includes(move.type) ? 1.5 : 1) * ((move.accuracy ?? 100) / 100);
      if (move.selfDestruct) score = hpRatio < 0.25 ? score : -1;
    } else if (move.fixedDamage !== undefined) {
      score = eff === 0 ? -1 : move.fixedDamage === "level" ? self.level * 1.4 : move.fixedDamage === "half" ? target.hp / 2 : Number(move.fixedDamage) * 1.4;
    } else if (move.heal || move.rest) {
      score = hpRatio < 0.4 && self.status !== "slp" ? 90 : -1;
    } else if (move.status) {
      score = target.status || (move.type === "Electric" && eff === 0) ? -1 : 45;
    } else if (move.confuse || move.leechSeed) {
      score = 30;
    } else if (move.stats) {
      const boost = move.stats.find((s) => s.target === "self");
      score = boost && selfStages[boost.stat] >= 2 ? -1 : 22;
    } else if (move.unsupported || move.splash || move.flee) {
      score = -5;
    }
    score *= 0.85 + rng.float() * 0.3;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
