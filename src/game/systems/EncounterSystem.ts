import { createPokemon, type PokemonInstance } from "../core/pokemon";
import { random, type RandomService } from "../services/RandomService";
import type { EncounterTable, Rarity } from "../world/types";

/** Legendary entries can never roll at a normal weight, whatever the data says. */
const RARITY_CAP: Record<Rarity, number> = { common: Infinity, uncommon: Infinity, rare: Infinity, legendary: 1 };

export class EncounterSystem {
  constructor(private rng: RandomService = random) {}

  /** Called once per completed step on an encounter tile. */
  rollStep(table: EncounterTable): PokemonInstance | null {
    if (!this.rng.chance(table.rate)) return null;
    return this.pick(table);
  }

  pick(table: EncounterTable): PokemonInstance | null {
    const entries = table.entries.map((e) => ({ ...e, weight: Math.min(e.weight, RARITY_CAP[e.rarity]) }));
    const entry = this.rng.weighted(entries);
    if (!entry) return null;
    return createPokemon(entry.speciesId, this.rng.int(entry.minLevel, entry.maxLevel));
  }
}
