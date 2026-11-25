import { createPokemon, type PokemonInstance } from "../core/pokemon";
import { random, type RandomService } from "../services/RandomService";
import type { EncounterTable, Rarity } from "../world/types";

/** Legendary entries can never roll at a normal weight, whatever the data says. */
export const SHINY_ODDS = 1 / 128;

const RARITY_CAP: Record<Rarity, number> = { common: Infinity, uncommon: Infinity, rare: Infinity, legendary: 1 };

export class EncounterSystem {
  constructor(private rng: RandomService = random) {}
  private consecutiveGrassSteps = 0;

  /** Called once per completed step on an encounter tile.
   * Gentle encounter pity avoids long empty grass walks without flooding battles. */
  rollStep(table: EncounterTable): PokemonInstance | null {
    this.consecutiveGrassSteps++;
    // First steps in grass are safe, then odds ramp gently; ~8 steps on average.
    if (this.consecutiveGrassSteps <= 2) return null;
    const pity = Math.min(0.12, (this.consecutiveGrassSteps - 3) * 0.012);
    const chance = Math.min(0.22, table.rate + pity);
    const triggered = this.consecutiveGrassSteps >= 20 || this.rng.chance(chance);
    if (!triggered) return null;
    this.consecutiveGrassSteps = 0;
    return this.pick(table);
  }

  get grassSteps() { return this.consecutiveGrassSteps; }

  /** Reset the pity counter when the player leaves encounter terrain. */
  leaveGrass() { this.consecutiveGrassSteps = 0; }

  pick(table: EncounterTable): PokemonInstance | null {
    const entries = table.entries.map((e) => ({ ...e, weight: Math.min(e.weight, RARITY_CAP[e.rarity]) }));
    const entry = this.rng.weighted(entries);
    if (!entry) return null;
    return createPokemon(entry.speciesId, this.rng.int(entry.minLevel, entry.maxLevel), { shiny: this.rng.chance(SHINY_ODDS) });
  }
}
