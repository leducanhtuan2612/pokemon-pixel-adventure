import type { MoveData, Stat, StatusCondition } from "../data/moves";
import type { PokemonType } from "../data/types";

/**
 * Resonance system: every elemental hit leaves a Mark (Dấu ấn) on the target.
 * Hitting a marked target with a different element triggers a Reaction,
 * consuming the mark. This replaces "spam the super-effective move" with
 * two-step combos the player plans across turns (and trainers exploit too).
 */
export type Element = "fire" | "water" | "wood" | "volt" | "wind" | "earth" | "frost" | "mystic" | "toxin";

export const ELEMENT_OF: Partial<Record<PokemonType, Element>> = {
  Fire: "fire", Water: "water", Grass: "wood", Bug: "wood", Electric: "volt",
  Flying: "wind", Dragon: "wind", Ground: "earth", Rock: "earth", Steel: "earth",
  Ice: "frost", Psychic: "mystic", Ghost: "mystic", Dark: "mystic", Poison: "toxin",
};

export const ELEMENT_INFO: Record<Element, { name: string; glyph: string; color: number; css: string }> = {
  fire: { name: "Hỏa", glyph: "火", color: 0xff6a2a, css: "#ff6a2a" },
  water: { name: "Thủy", glyph: "水", color: 0x3aa8ff, css: "#3aa8ff" },
  wood: { name: "Mộc", glyph: "木", color: 0x5fd34a, css: "#5fd34a" },
  volt: { name: "Lôi", glyph: "雷", color: 0xffd83a, css: "#ffd83a" },
  wind: { name: "Phong", glyph: "風", color: 0x9fe8ff, css: "#9fe8ff" },
  earth: { name: "Thổ", glyph: "土", color: 0xc8955a, css: "#c8955a" },
  frost: { name: "Băng", glyph: "氷", color: 0xaaf2ff, css: "#aaf2ff" },
  mystic: { name: "Huyền", glyph: "幻", color: 0xc070ff, css: "#c070ff" },
  toxin: { name: "Độc", glyph: "毒", color: 0xb050d0, css: "#b050d0" },
};

export const elementOf = (move: Pick<MoveData, "type">): Element | null => ELEMENT_OF[move.type] ?? null;

export interface Reaction {
  name: string;
  /** Damage multiplier applied to the triggering hit. */
  mult: number;
  color: number;
  status?: { cond: StatusCondition; chance: number };
  /** Stat change applied to the target. */
  debuff?: { stat: Stat; stages: number };
  /** Attacker heals this fraction of the damage dealt. */
  heal?: number;
  confuse?: number;
}

const key = (a: Element, b: Element) => [a, b].sort().join("+");
const R = (a: Element, b: Element, r: Reaction): [string, Reaction] => [key(a, b), r];

const TABLE = new Map<string, Reaction>([
  R("fire", "wood", { name: "THIÊU RỤI", mult: 1.6, color: 0xff7a2a, status: { cond: "brn", chance: 0.35 } }),
  R("fire", "wind", { name: "BÃO LỬA", mult: 1.5, color: 0xff9a40 }),
  R("fire", "water", { name: "BỐC HƠI", mult: 1.5, color: 0xd8f0ff, debuff: { stat: "acc", stages: -1 } }),
  R("fire", "frost", { name: "TAN CHẢY", mult: 1.5, color: 0xffc0a0 }),
  R("fire", "earth", { name: "DUNG NHAM", mult: 1.4, color: 0xff5020, debuff: { stat: "def", stages: -1 } }),
  R("fire", "toxin", { name: "KHÍ ĐỘC NỔ", mult: 1.6, color: 0xe060ff }),
  R("volt", "water", { name: "DẪN ĐIỆN", mult: 1.5, color: 0xfff060, status: { cond: "par", chance: 0.3 } }),
  R("volt", "wind", { name: "SẤM BÃO", mult: 1.5, color: 0xf0f8ff }),
  R("volt", "earth", { name: "TIẾP ĐỊA", mult: 1.2, color: 0xe0c070, debuff: { stat: "spe", stages: -1 } }),
  R("frost", "water", { name: "ĐÓNG BĂNG", mult: 1.3, color: 0xc8f8ff, debuff: { stat: "spe", stages: -2 } }),
  R("frost", "wind", { name: "BÃO TUYẾT", mult: 1.4, color: 0xe8fcff }),
  R("wood", "water", { name: "NẢY MẦM", mult: 1.2, color: 0x90ff70, heal: 0.3 }),
  R("earth", "water", { name: "BÙN LẦY", mult: 1.3, color: 0x9a7048, debuff: { stat: "spe", stages: -1 } }),
  R("wood", "toxin", { name: "TỬ LÂM", mult: 1.4, color: 0x9040c0, status: { cond: "psn", chance: 0.4 } }),
  R("earth", "wind", { name: "BÃO CÁT", mult: 1.3, color: 0xe0c090, debuff: { stat: "acc", stages: -1 } }),
]);

/** Reaction for (mark already on target, incoming element). Same element = no reaction (mark refreshes). */
export function reactionFor(mark: Element, incoming: Element): Reaction | null {
  if (mark === incoming) return null;
  const hit = TABLE.get(key(mark, incoming));
  if (hit) return hit;
  if (mark === "mystic" || incoming === "mystic") return { name: "RỐI TRÍ", mult: 1.25, color: 0xc070ff, confuse: 0.3 };
  return { name: "CỘNG HƯỞNG", mult: 1.2, color: 0xffffff };
}

/* ------------------------------------------------------------------ */
/* Energy                                                              */
/* ------------------------------------------------------------------ */

export const ENERGY_MAX = 10;
export const ENERGY_START = 4;
export const ENERGY_REGEN = 2;
export const GUARD_ENERGY = 3;

/** Energy cost replaces PP: weak moves are free, big moves need setup turns. */
export function energyCost(move: MoveData): number {
  if (move.id.startsWith("ult-")) return 0;
  if (move.ohko) return 6;
  if (move.fixedDamage !== undefined) return 3;
  if (move.power === 0) return move.heal || move.rest ? 3 : 2;
  const p = move.multiHit ? move.power * 3 : move.power;
  return p <= 40 ? 0 : p <= 60 ? 2 : p <= 80 ? 3 : p <= 100 ? 4 : p <= 120 ? 5 : 6;
}

/* ------------------------------------------------------------------ */
/* Surge (ultimate)                                                    */
/* ------------------------------------------------------------------ */

export const SURGE_MAX = 100;

/** Original ultimate names per element; Normal/Fighting use the "none" entry. */
export const ULTIMATES: Record<Element | "none", string> = {
  fire: "Hỏa Long Thiên Phạt",
  water: "Thủy Triều Nguyên Sơ",
  wood: "Vạn Diệp Thần Thụ",
  volt: "Lôi Thần Giáng Thế",
  wind: "Thiên Phong Trảm",
  earth: "Địa Chấn Long Mạch",
  frost: "Băng Hà Vĩnh Cửu",
  mystic: "Tinh Không Hư Vô",
  toxin: "Độc Vụ Tử Lâm",
  none: "Phá Thiên Quyền",
};

/** Builds the ultimate: element from the user's own type, power from its strongest damaging move. */
export function ultimateFrom(moves: MoveData[], userTypes: PokemonType[]): MoveData {
  const damaging = moves.filter((m) => m.power > 0);
  const score = (m: MoveData) => m.power * (userTypes.includes(m.type) ? 1.5 : 1);
  const base = damaging.sort((a, b) => score(b) - score(a))[0]
    ?? { id: "tackle", name: "Tackle", type: userTypes[0] ?? "Normal", power: 40, accuracy: 100, pp: 1, desc: "" } as MoveData;
  // The creature's own element defines its ultimate (a Water creature always unleashes a tide);
  // pure Normal/Fighting creatures borrow the element of their strongest move.
  const ownType = userTypes.find((t) => ELEMENT_OF[t]);
  const el = ownType ? ELEMENT_OF[ownType]! : elementOf(base);
  return {
    id: `ult-${el ?? "none"}`,
    name: ULTIMATES[el ?? "none"],
    type: ownType ?? base.type,
    power: Math.max(120, Math.round(base.power * 1.8)),
    accuracy: null,
    pp: 1,
    desc: `Tuyệt kỹ bộc phát dựa trên ${base.name}. Không bao giờ trượt.`,
  };
}
