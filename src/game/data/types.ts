/** Gen 3 type system (17 types, no Fairy). Category follows the move's type, as in FireRed/Emerald. */
export const TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel",
] as const;
export type PokemonType = typeof TYPES[number];

const PHYSICAL = new Set<PokemonType>(["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel"]);
export const categoryOf = (t: PokemonType): "physical" | "special" => (PHYSICAL.has(t) ? "physical" : "special");

type Row = Partial<Record<PokemonType, number>>;
const CHART: Record<PokemonType, Row> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5, Steel: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Steel: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5 },
};

export function effectiveness(attack: PokemonType, defender: readonly PokemonType[]): number {
  const row = CHART[attack] ?? {};
  return defender.reduce((m, t) => m * (row[t] ?? 1), 1);
}

export const TYPE_COLORS: Record<PokemonType, string> = {
  Normal: "#a8a878", Fire: "#f08030", Water: "#6890f0", Electric: "#f8d030", Grass: "#78c850", Ice: "#98d8d8",
  Fighting: "#c03028", Poison: "#a040a0", Ground: "#e0c068", Flying: "#a890f0", Psychic: "#f85888", Bug: "#a8b820",
  Rock: "#b8a038", Ghost: "#705898", Dragon: "#7038f8", Dark: "#705848", Steel: "#b8b8d0",
};

export const TYPE_VI: Record<PokemonType, string> = {
  Normal: "Thường", Fire: "Lửa", Water: "Nước", Electric: "Điện", Grass: "Cỏ", Ice: "Băng", Fighting: "Giác đấu",
  Poison: "Độc", Ground: "Đất", Flying: "Bay", Psychic: "Siêu linh", Bug: "Bọ", Rock: "Đá", Ghost: "Ma",
  Dragon: "Rồng", Dark: "Bóng tối", Steel: "Thép",
};
