import generated from "./generated/species.json";
import { TYPE_VI, type PokemonType } from "./types";

export type GrowthRate = "fast" | "mediumFast" | "mediumSlow" | "slow";
export interface BaseStats { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }

export type Evolution =
  | { kind: "level"; level: number; into: string }
  | { kind: "item"; item: string; into: string };

export interface Species {
  id: string;
  dex: number;
  name: string;
  types: PokemonType[];
  base: BaseStats;
  catchRate: number;   // 0–255
  baseExp: number;     // base experience yield
  growth: GrowthRate;
  /** [level, moveId] — level 1 entries are the starting moves. */
  learnset: [number, string][];
  evolutions: Evolution[];
  weightKg: number;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  dexEntry: string;
}

/**
 * Stats, types, Gen 3 learnsets and evolutions come from @pkmn/dex via
 * `npm run gen:data`. Catch rates / EXP yields for the core cast use the
 * real Gen 3 values below; the rest are estimated from base stat totals.
 */
const OVERRIDES: Record<string, Partial<Species>> = {
  bulbasaur: { catchRate: 45, baseExp: 64, dexEntry: "Mang hạt giống trên lưng từ lúc mới sinh." },
  ivysaur: { catchRate: 45, baseExp: 141, dexEntry: "Nụ hoa trên lưng lớn dần khi hấp thụ dinh dưỡng." },
  venusaur: { catchRate: 45, baseExp: 208, dexEntry: "Bông hoa lớn tỏa hương thơm dịu khi tắm nắng." },
  charmander: { catchRate: 45, baseExp: 65, dexEntry: "Ngọn lửa trên đuôi thể hiện sức sống của nó." },
  charmeleon: { catchRate: 45, baseExp: 142, dexEntry: "Tính khí hung hăng, luôn tìm đối thủ mạnh." },
  charizard: { catchRate: 45, baseExp: 209, dexEntry: "Bay khắp trời tìm kiếm đối thủ xứng tầm." },
  squirtle: { catchRate: 45, baseExp: 66, dexEntry: "Rụt vào mai để tự vệ rồi phun nước phản công." },
  wartortle: { catchRate: 45, baseExp: 143, dexEntry: "Đuôi lông xù là biểu tượng của sự trường thọ." },
  blastoise: { catchRate: 45, baseExp: 210, dexEntry: "Vòi nước trên mai bắn xuyên cả thép." },
  caterpie: { catchRate: 255, baseExp: 53, dexEntry: "Nhả tơ dính để bắt mồi." },
  metapod: { catchRate: 120, baseExp: 72, dexEntry: "Vỏ kén cứng như thép bảo vệ cơ thể mềm bên trong." },
  butterfree: { catchRate: 45, baseExp: 160, dexEntry: "Phấn trên cánh có thể gây ngủ hoặc tê liệt." },
  pidgey: { catchRate: 255, baseExp: 55, dexEntry: "Hiền lành, thường hất cát thay vì chiến đấu." },
  pidgeotto: { catchRate: 120, baseExp: 113, dexEntry: "Bảo vệ lãnh thổ rộng lớn của mình rất quyết liệt." },
  pidgeot: { catchRate: 45, baseExp: 172, dexEntry: "Bay nhanh gấp đôi tốc độ âm thanh." },
  rattata: { catchRate: 255, baseExp: 57, dexEntry: "Răng cửa mọc mãi nên phải gặm liên tục." },
  raticate: { catchRate: 127, baseExp: 116, dexEntry: "Răng nanh đủ sức gặm thủng bê tông." },
  pikachu: { catchRate: 190, baseExp: 82, dexEntry: "Tích điện trong túi má, phóng ra khi gặp nguy." },
  raichu: { catchRate: 75, baseExp: 122, dexEntry: "Đuôi làm cột thu lôi, xả điện xuống đất." },
  vulpix: { catchRate: 190, baseExp: 63, dexEntry: "Sinh ra chỉ có một đuôi, đuôi sẽ tách dần khi lớn." },
  ninetales: { catchRate: 75, baseExp: 178, dexEntry: "Được cho là sống đến nghìn năm." },
  zubat: { catchRate: 255, baseExp: 54, dexEntry: "Không có mắt, định hướng bằng sóng siêu âm." },
  golbat: { catchRate: 90, baseExp: 171, dexEntry: "Hút máu bằng răng nanh sắc nhọn." },
  oddish: { catchRate: 255, baseExp: 78, dexEntry: "Ban ngày vùi mình trong đất, đêm mới đi dạo." },
  gloom: { catchRate: 120, baseExp: 132, dexEntry: "Mật hoa có mùi cực kỳ khó chịu." },
  vileplume: { catchRate: 45, baseExp: 184, dexEntry: "Cánh hoa lớn nhất thế giới, rải phấn độc." },
  psyduck: { catchRate: 190, baseExp: 80, dexEntry: "Luôn đau đầu, khi đau quá sẽ bộc phát siêu năng lực." },
  golduck: { catchRate: 75, baseExp: 174, dexEntry: "Bơi nhanh nhất trong các Pokémon nước." },
  geodude: { catchRate: 255, baseExp: 86, dexEntry: "Hay bị nhầm là hòn đá ven đường." },
  graveler: { catchRate: 120, baseExp: 134, dexEntry: "Lăn xuống núi, nghiền nát mọi thứ trên đường." },
  snorlax: { catchRate: 25, baseExp: 154, rarity: "legendary", dexEntry: "Chỉ ăn và ngủ. Mỗi ngày ăn hết 400 kg thức ăn." },
};

const PET_NAME_ROOTS: Record<PokemonType, string[]> = {
  Normal: ["Mim", "Poff", "Tumble", "Fable"], Fire: ["Cind", "Pyra", "Ember", "Flari"],
  Water: ["Aqua", "Bubbi", "Tide", "Mizu"], Electric: ["Volt", "Zappa", "Sparko", "Fulgur"],
  Grass: ["Moss", "Fern", "Clover", "Sprig"], Ice: ["Frost", "Glaci", "Snow", "Cryo"],
  Fighting: ["Brava", "Knuck", "Rumble", "Brawli"], Poison: ["Venom", "Spora", "Toxi", "Noxi"],
  Ground: ["Terra", "Pebbi", "Dun", "Gravi"], Flying: ["Zeph", "Aeri", "Gale", "Wing"],
  Psychic: ["Aura", "Mindra", "Soma", "Myst"], Bug: ["Nimbi", "Beet", "Silka", "Mothy"],
  Rock: ["Crag", "Flint", "Bould", "Pebble"], Ghost: ["Wisp", "Shade", "Phanta", "Gloam"],
  Dragon: ["Drako", "Wyrm", "Drazi", "Myth"], Dark: ["Umbra", "Dusk", "Nocta", "Vanta"],
  Steel: ["Ferr", "Alloy", "Mecha", "Brass"],
};
const PET_NAME_ENDINGS = ["ling", "kin", "puff", "let", "wing", "mote", "bud", "fang", "shell", "bloom", "whisk", "scale", "crest", "glow", "tail", "sprout", "paw", "flit"];

function makePetName(id: string, dex: number, type: PokemonType) {
  let seed = dex * 31;
  for (let i = 0; i < id.length; i++) seed = (seed * 33 + id.charCodeAt(i)) >>> 0;
  const roots = PET_NAME_ROOTS[type];
  return roots[seed % roots.length] + PET_NAME_ENDINGS[Math.floor(seed / roots.length) % PET_NAME_ENDINGS.length];
}

type Raw = Omit<Species, "dexEntry"> & { types: string[] };

export const SPECIES_LIST: Species[] = (generated as Raw[]).map((raw) => {
  const types = raw.types as PokemonType[];
  const name = makePetName(raw.id, raw.dex, types[0]);
  const entry = `Linh thú ${name} mang thuộc tính ${types.map((t) => TYPE_VI[t]).join(" · ")}. Mỗi cá thể có dáng vẻ và sức mạnh riêng.`;
  return {
    ...raw,
    types,
    learnset: raw.learnset as [number, string][],
    ...OVERRIDES[raw.id],
    name,
    dexEntry: entry,
  };
});

export const SPECIES: Record<string, Species> = Object.fromEntries(SPECIES_LIST.map((sp) => [sp.id, sp]));
export const getSpecies = (id: string): Species => SPECIES[id] ?? SPECIES[id.replace(/[^a-z0-9]/g, "")] ?? SPECIES.caterpie;
