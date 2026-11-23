/**
 * Tile legend for ASCII map layouts. Adding a new tile type means adding a
 * rule here and a painter in TilesetFactory — no gameplay code changes.
 */
export interface TileRule {
  name: string;
  solid: boolean;
  encounter?: boolean;
}

export const TILE_RULES: Record<string, TileRule> = {
  ".": { name: "ground", solid: false },
  "*": { name: "flowers", solid: false },
  ":": { name: "tall-grass", solid: false, encounter: true },
  "=": { name: "path", solid: false },
  "s": { name: "sand", solid: false },
  "E": { name: "exit", solid: false },
  "~": { name: "water", solid: true },
  "T": { name: "tree", solid: true },
  "R": { name: "rock", solid: true },
  "C": { name: "cliff", solid: true },
  "F": { name: "fence", solid: true },
  "S": { name: "sign", solid: true },
  "B": { name: "building", solid: true },
  "D": { name: "door", solid: true },
};

export const ruleFor = (ch: string): TileRule => TILE_RULES[ch] ?? { name: "unknown", solid: true };

/** Tile chars that visually connect to path tiles. */
export const PATH_LIKE = new Set(["=", "E", "D"]);
export const WATER_LIKE = new Set(["~"]);
