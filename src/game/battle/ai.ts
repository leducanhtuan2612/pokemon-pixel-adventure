import { getMove } from "../data/moves";
import { getSpecies } from "../data/species";
import { effectiveness } from "../data/types";
import { maxHp, type PokemonInstance } from "../core/pokemon";
import type { RandomService } from "../services/RandomService";
import type { Stages } from "./formulas";
import { elementOf, energyCost, reactionFor, type Element } from "./elements";

export const AI_GUARD = -3;
export const AI_ULTIMATE = -4;

export interface AiContext {
  energy: number;
  surgeReady: boolean;
  /** Mark currently on the AI's target. */
  targetMark: Element | null;
  /** The opponent's ultimate is charged: a smart AI braces for it. */
  threatReady?: boolean;
}

/**
 * Returns a move index, AI_GUARD or AI_ULTIMATE. Wild creatures pick randomly
 * among affordable moves; trainers score moves, plan reactions and manage energy.
 */
export function chooseMove(rng: RandomService, self: PokemonInstance, selfStages: Stages, target: PokemonInstance, smart: boolean, ctx: AiContext): number {
  const usable = self.moves.map((m, i) => ({ m, i, move: getMove(m.id) })).filter(({ move }) => energyCost(move) <= ctx.energy);
  if (ctx.surgeReady && (smart || rng.chance(0.5))) return AI_ULTIMATE;
  if (!usable.length) return AI_GUARD;
  if (!smart) {
    if (ctx.energy <= 2 && rng.chance(0.25)) return AI_GUARD;
    return usable[rng.int(0, usable.length - 1)].i;
  }

  const myTypes = getSpecies(self.speciesId).types, theirTypes = getSpecies(target.speciesId).types;
  const hpRatio = self.hp / maxHp(self);
  let best = usable[0].i, bestScore = -Infinity;
  for (const { i, move } of usable) {
    const eff = effectiveness(move.type, theirTypes);
    const el = elementOf(move);
    const reaction = ctx.targetMark && el ? reactionFor(ctx.targetMark, el) : null;
    let score = 1;
    if (move.power > 0) {
      const hits = move.multiHit ? 3 : 1;
      score = move.power * hits * eff * (myTypes.includes(move.type) ? 1.5 : 1) * ((move.accuracy ?? 100) / 100);
      if (reaction) score *= reaction.mult + 0.15;
      else if (el && !ctx.targetMark) score *= 1.08; // set up a mark for a follow-up
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
    // Spending energy has an opportunity cost: keep some for the big hits.
    score -= energyCost(move) * 2.5;
    score *= 0.85 + rng.float() * 0.3;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  // Brace for the opponent's ultimate, or bank energy when only weak options remain.
  if (ctx.threatReady && rng.chance(0.6)) return AI_GUARD;
  if (bestScore < 25 && ctx.energy < 4 && rng.chance(0.5)) return AI_GUARD;
  return best;
}
