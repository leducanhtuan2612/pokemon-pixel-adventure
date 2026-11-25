import type { PokemonType } from "./types";

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
  catchRate: number;   // 0–255, Gen 3 values
  baseExp: number;     // Gen 3 base experience yield
  growth: GrowthRate;
  /** [level, moveId] — level 1 entries are the starting moves. */
  learnset: [number, string][];
  evolutions?: Evolution[];
  rarity: "common" | "uncommon" | "rare" | "legendary";
  dexEntry: string;
}

const s = (d: Species) => d;
const b = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): BaseStats => ({ hp, atk, def, spa, spd, spe });

export const SPECIES_LIST: Species[] = [
  s({ id: "bulbasaur", dex: 1, name: "Bulbasaur", types: ["Grass", "Poison"], base: b(45, 49, 49, 65, 65, 45), catchRate: 45, baseExp: 64, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "tackle"], [4, "growl"], [7, "absorb"], [10, "vine-whip"], [15, "poison-powder"], [15, "sleep-powder"], [20, "razor-leaf"], [25, "growth"], [32, "sludge"], [39, "solar-beam"]],
    evolutions: [{ kind: "level", level: 16, into: "ivysaur" }], dexEntry: "Mang hạt giống trên lưng từ lúc mới sinh." }),
  s({ id: "ivysaur", dex: 2, name: "Ivysaur", types: ["Grass", "Poison"], base: b(60, 62, 63, 80, 80, 60), catchRate: 45, baseExp: 141, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "tackle"], [1, "growl"], [7, "absorb"], [10, "vine-whip"], [15, "poison-powder"], [15, "sleep-powder"], [22, "razor-leaf"], [29, "growth"], [36, "sludge"], [44, "solar-beam"]],
    evolutions: [{ kind: "level", level: 32, into: "venusaur" }], dexEntry: "Nụ hoa trên lưng lớn dần khi hấp thụ dinh dưỡng." }),
  s({ id: "venusaur", dex: 3, name: "Venusaur", types: ["Grass", "Poison"], base: b(80, 82, 83, 100, 100, 80), catchRate: 45, baseExp: 208, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "vine-whip"], [1, "razor-leaf"], [1, "growth"], [1, "sleep-powder"], [32, "petal-dance"], [41, "sludge-bomb"], [50, "solar-beam"]],
    dexEntry: "Bông hoa lớn tỏa hương thơm dịu khi tắm nắng." }),
  s({ id: "charmander", dex: 4, name: "Charmander", types: ["Fire"], base: b(39, 52, 43, 60, 50, 65), catchRate: 45, baseExp: 65, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "scratch"], [1, "growl"], [7, "ember"], [13, "metal-claw"], [19, "smokescreen"], [25, "flame-wheel"], [31, "slash"], [37, "flamethrower"]],
    evolutions: [{ kind: "level", level: 16, into: "charmeleon" }], dexEntry: "Ngọn lửa trên đuôi thể hiện sức sống của nó." }),
  s({ id: "charmeleon", dex: 5, name: "Charmeleon", types: ["Fire"], base: b(58, 64, 58, 80, 65, 80), catchRate: 45, baseExp: 142, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "scratch"], [1, "growl"], [1, "ember"], [13, "metal-claw"], [20, "smokescreen"], [27, "flame-wheel"], [30, "dragon-rage"], [34, "slash"], [41, "flamethrower"]],
    evolutions: [{ kind: "level", level: 36, into: "charizard" }], dexEntry: "Tính khí hung hăng, luôn tìm đối thủ mạnh." }),
  s({ id: "charizard", dex: 6, name: "Charizard", types: ["Fire", "Flying"], base: b(78, 84, 78, 109, 85, 100), catchRate: 45, baseExp: 209, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "ember"], [1, "metal-claw"], [1, "slash"], [1, "dragon-breath"], [36, "wing-attack"], [44, "flamethrower"], [54, "aerial-ace"]],
    dexEntry: "Bay khắp trời tìm kiếm đối thủ xứng tầm." }),
  s({ id: "squirtle", dex: 7, name: "Squirtle", types: ["Water"], base: b(44, 48, 65, 50, 64, 43), catchRate: 45, baseExp: 66, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "tackle"], [4, "tail-whip"], [7, "bubble"], [10, "withdraw"], [13, "water-gun"], [18, "bite"], [23, "rock-tomb"], [28, "water-pulse"], [33, "bubble-beam"], [40, "hydro-pump"]],
    evolutions: [{ kind: "level", level: 16, into: "wartortle" }], dexEntry: "Rụt vào mai để tự vệ rồi phun nước phản công." }),
  s({ id: "wartortle", dex: 8, name: "Wartortle", types: ["Water"], base: b(59, 63, 80, 65, 80, 58), catchRate: 45, baseExp: 143, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "tackle"], [1, "tail-whip"], [1, "bubble"], [10, "withdraw"], [13, "water-gun"], [19, "bite"], [25, "rock-tomb"], [31, "water-pulse"], [37, "bubble-beam"], [45, "hydro-pump"]],
    evolutions: [{ kind: "level", level: 36, into: "blastoise" }], dexEntry: "Đuôi lông xù là biểu tượng của sự trường thọ." }),
  s({ id: "blastoise", dex: 9, name: "Blastoise", types: ["Water"], base: b(79, 83, 100, 85, 105, 78), catchRate: 45, baseExp: 210, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "water-gun"], [1, "bite"], [1, "rock-tomb"], [1, "water-pulse"], [36, "surf"], [42, "iron-defense"], [50, "hydro-pump"]],
    dexEntry: "Vòi nước trên mai bắn xuyên cả thép." }),
  s({ id: "caterpie", dex: 10, name: "Caterpie", types: ["Bug"], base: b(45, 30, 35, 20, 20, 45), catchRate: 255, baseExp: 53, growth: "mediumFast", rarity: "common",
    learnset: [[1, "tackle"], [1, "string-shot"]], evolutions: [{ kind: "level", level: 7, into: "metapod" }], dexEntry: "Nhả tơ dính để bắt mồi." }),
  s({ id: "metapod", dex: 11, name: "Metapod", types: ["Bug"], base: b(50, 20, 55, 25, 25, 30), catchRate: 120, baseExp: 72, growth: "mediumFast", rarity: "uncommon",
    learnset: [[1, "harden"], [1, "tackle"]], evolutions: [{ kind: "level", level: 10, into: "butterfree" }], dexEntry: "Vỏ kén cứng như thép bảo vệ cơ thể mềm bên trong." }),
  s({ id: "butterfree", dex: 12, name: "Butterfree", types: ["Bug", "Flying"], base: b(60, 45, 50, 80, 80, 70), catchRate: 45, baseExp: 160, growth: "mediumFast", rarity: "rare",
    learnset: [[1, "confusion"], [10, "confusion"], [13, "poison-powder"], [14, "stun-spore"], [15, "sleep-powder"], [18, "gust"], [23, "silver-wind"], [28, "psybeam"], [34, "signal-beam"]],
    dexEntry: "Phấn trên cánh có thể gây ngủ hoặc tê liệt." }),
  s({ id: "pidgey", dex: 16, name: "Pidgey", types: ["Normal", "Flying"], base: b(40, 45, 40, 35, 35, 56), catchRate: 255, baseExp: 55, growth: "mediumSlow", rarity: "common",
    learnset: [[1, "tackle"], [5, "sand-attack"], [9, "gust"], [13, "quick-attack"], [19, "wing-attack"], [25, "agility"], [31, "aerial-ace"]],
    evolutions: [{ kind: "level", level: 18, into: "pidgeotto" }], dexEntry: "Hiền lành, thường hất cát thay vì chiến đấu." }),
  s({ id: "pidgeotto", dex: 17, name: "Pidgeotto", types: ["Normal", "Flying"], base: b(63, 60, 55, 50, 50, 71), catchRate: 120, baseExp: 113, growth: "mediumSlow", rarity: "uncommon",
    learnset: [[1, "tackle"], [1, "sand-attack"], [1, "gust"], [13, "quick-attack"], [20, "wing-attack"], [27, "agility"], [34, "aerial-ace"]],
    evolutions: [{ kind: "level", level: 36, into: "pidgeot" }], dexEntry: "Bảo vệ lãnh thổ rộng lớn của mình rất quyết liệt." }),
  s({ id: "pidgeot", dex: 18, name: "Pidgeot", types: ["Normal", "Flying"], base: b(83, 80, 75, 70, 70, 101), catchRate: 45, baseExp: 172, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "gust"], [1, "quick-attack"], [1, "wing-attack"], [1, "agility"], [36, "aerial-ace"], [44, "air-cutter"]], dexEntry: "Bay nhanh gấp đôi tốc độ âm thanh." }),
  s({ id: "rattata", dex: 19, name: "Rattata", types: ["Normal"], base: b(30, 56, 35, 25, 35, 72), catchRate: 255, baseExp: 57, growth: "mediumFast", rarity: "common",
    learnset: [[1, "tackle"], [1, "tail-whip"], [7, "quick-attack"], [13, "hyper-fang"], [20, "focus-energy"], [27, "bite"], [34, "crunch"]],
    evolutions: [{ kind: "level", level: 20, into: "raticate" }], dexEntry: "Răng cửa mọc mãi nên phải gặm liên tục." }),
  s({ id: "raticate", dex: 20, name: "Raticate", types: ["Normal"], base: b(55, 81, 60, 50, 70, 97), catchRate: 127, baseExp: 116, growth: "mediumFast", rarity: "uncommon",
    learnset: [[1, "tackle"], [1, "tail-whip"], [1, "quick-attack"], [13, "hyper-fang"], [20, "focus-energy"], [30, "bite"], [40, "crunch"]], dexEntry: "Răng nanh đủ sức gặm thủng bê tông." }),
  s({ id: "pikachu", dex: 25, name: "Pikachu", types: ["Electric"], base: b(35, 55, 30, 50, 40, 90), catchRate: 190, baseExp: 82, growth: "mediumFast", rarity: "rare",
    learnset: [[1, "thunder-shock"], [1, "growl"], [6, "tail-whip"], [8, "thunder-wave"], [11, "quick-attack"], [20, "spark"], [26, "agility"], [33, "thunderbolt"]],
    evolutions: [{ kind: "item", item: "thunder-stone", into: "raichu" }], dexEntry: "Tích điện trong túi má, phóng ra khi gặp nguy." }),
  s({ id: "raichu", dex: 26, name: "Raichu", types: ["Electric"], base: b(60, 90, 55, 90, 80, 100), catchRate: 75, baseExp: 122, growth: "mediumFast", rarity: "rare",
    learnset: [[1, "thunder-shock"], [1, "tail-whip"], [1, "quick-attack"], [1, "thunderbolt"]], dexEntry: "Đuôi làm cột thu lôi, xả điện xuống đất." }),
  s({ id: "vulpix", dex: 37, name: "Vulpix", types: ["Fire"], base: b(38, 41, 40, 50, 65, 65), catchRate: 190, baseExp: 63, growth: "mediumFast", rarity: "rare",
    learnset: [[1, "ember"], [5, "tail-whip"], [9, "will-o-wisp"], [13, "quick-attack"], [17, "fire-spin"], [21, "confusion"], [29, "flame-wheel"], [37, "flamethrower"]],
    evolutions: [{ kind: "item", item: "fire-stone", into: "ninetales" }], dexEntry: "Sinh ra chỉ có một đuôi, đuôi sẽ tách dần khi lớn." }),
  s({ id: "ninetales", dex: 38, name: "Ninetales", types: ["Fire"], base: b(73, 76, 75, 81, 100, 100), catchRate: 75, baseExp: 178, growth: "mediumFast", rarity: "rare",
    learnset: [[1, "ember"], [1, "quick-attack"], [1, "confusion"], [1, "flamethrower"]], dexEntry: "Được cho là sống đến nghìn năm." }),
  s({ id: "zubat", dex: 41, name: "Zubat", types: ["Poison", "Flying"], base: b(40, 45, 35, 30, 40, 55), catchRate: 255, baseExp: 54, growth: "mediumFast", rarity: "common",
    learnset: [[1, "leech-life"], [6, "poison-sting"], [11, "bite"], [16, "wing-attack"], [21, "air-cutter"], [26, "confusion"]],
    evolutions: [{ kind: "level", level: 22, into: "golbat" }], dexEntry: "Không có mắt, định hướng bằng sóng siêu âm." }),
  s({ id: "golbat", dex: 42, name: "Golbat", types: ["Poison", "Flying"], base: b(75, 80, 70, 65, 75, 90), catchRate: 90, baseExp: 171, growth: "mediumFast", rarity: "uncommon",
    learnset: [[1, "leech-life"], [1, "poison-sting"], [1, "bite"], [1, "wing-attack"], [24, "air-cutter"], [30, "crunch"], [38, "sludge-bomb"]], dexEntry: "Hút máu bằng răng nanh sắc nhọn." }),
  s({ id: "oddish", dex: 43, name: "Oddish", types: ["Grass", "Poison"], base: b(45, 50, 55, 75, 65, 30), catchRate: 255, baseExp: 78, growth: "mediumSlow", rarity: "uncommon",
    learnset: [[1, "absorb"], [7, "growth"], [11, "poison-powder"], [13, "stun-spore"], [15, "sleep-powder"], [19, "acid"], [24, "mega-drain"], [32, "petal-dance"]],
    evolutions: [{ kind: "level", level: 21, into: "gloom" }], dexEntry: "Ban ngày vùi mình trong đất, đêm mới đi dạo." }),
  s({ id: "gloom", dex: 44, name: "Gloom", types: ["Grass", "Poison"], base: b(60, 65, 70, 85, 75, 40), catchRate: 120, baseExp: 132, growth: "mediumSlow", rarity: "uncommon",
    learnset: [[1, "absorb"], [1, "growth"], [1, "poison-powder"], [1, "stun-spore"], [15, "sleep-powder"], [19, "acid"], [26, "mega-drain"], [35, "petal-dance"]],
    evolutions: [{ kind: "item", item: "leaf-stone", into: "vileplume" }], dexEntry: "Mật hoa có mùi cực kỳ khó chịu." }),
  s({ id: "vileplume", dex: 45, name: "Vileplume", types: ["Grass", "Poison"], base: b(75, 80, 85, 100, 90, 50), catchRate: 45, baseExp: 184, growth: "mediumSlow", rarity: "rare",
    learnset: [[1, "mega-drain"], [1, "stun-spore"], [1, "acid"], [1, "petal-dance"], [44, "sludge-bomb"], [50, "solar-beam"]], dexEntry: "Cánh hoa lớn nhất thế giới, rải phấn độc." }),
  s({ id: "psyduck", dex: 54, name: "Psyduck", types: ["Water"], base: b(50, 52, 48, 65, 50, 55), catchRate: 190, baseExp: 80, growth: "mediumFast", rarity: "uncommon",
    learnset: [[1, "water-gun"], [1, "scratch"], [5, "tail-whip"], [16, "confusion"], [23, "water-pulse"], [31, "psybeam"], [40, "surf"]],
    evolutions: [{ kind: "level", level: 33, into: "golduck" }], dexEntry: "Luôn đau đầu, khi đau quá sẽ bộc phát siêu năng lực." }),
  s({ id: "golduck", dex: 55, name: "Golduck", types: ["Water"], base: b(80, 82, 78, 95, 80, 85), catchRate: 75, baseExp: 174, growth: "mediumFast", rarity: "rare",
    learnset: [[1, "water-gun"], [1, "confusion"], [1, "water-pulse"], [1, "psybeam"], [37, "surf"], [48, "hydro-pump"]], dexEntry: "Bơi nhanh nhất trong các Pokémon nước." }),
  s({ id: "geodude", dex: 74, name: "Geodude", types: ["Rock", "Ground"], base: b(40, 80, 100, 30, 30, 20), catchRate: 255, baseExp: 86, growth: "mediumSlow", rarity: "common",
    learnset: [[1, "tackle"], [1, "defense-curl"], [6, "mud-slap"], [11, "rock-throw"], [16, "magnitude"], [21, "rock-tomb"], [31, "rock-slide"], [41, "earthquake"]],
    evolutions: [{ kind: "level", level: 25, into: "graveler" }], dexEntry: "Hay bị nhầm là hòn đá ven đường." }),
  s({ id: "graveler", dex: 75, name: "Graveler", types: ["Rock", "Ground"], base: b(55, 95, 115, 45, 45, 35), catchRate: 120, baseExp: 134, growth: "mediumSlow", rarity: "uncommon",
    learnset: [[1, "tackle"], [1, "defense-curl"], [1, "mud-slap"], [1, "rock-throw"], [16, "magnitude"], [21, "rock-tomb"], [34, "rock-slide"], [45, "earthquake"]], dexEntry: "Lăn xuống núi, nghiền nát mọi thứ trên đường." }),
  s({ id: "snorlax", dex: 143, name: "Snorlax", types: ["Normal"], base: b(160, 110, 65, 65, 110, 30), catchRate: 25, baseExp: 154, growth: "slow", rarity: "legendary",
    learnset: [[1, "tackle"], [6, "defense-curl"], [10, "amnesia"], [15, "lick"], [19, "headbutt"], [24, "rest"], [33, "body-slam"], [42, "crunch"]], dexEntry: "Chỉ ăn và ngủ. Mỗi ngày ăn hết 400 kg thức ăn." }),
];

export const SPECIES: Record<string, Species> = Object.fromEntries(SPECIES_LIST.map((sp) => [sp.id, sp]));
export const getSpecies = (id: string): Species => SPECIES[id] ?? SPECIES.caterpie;
