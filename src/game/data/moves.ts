import type { PokemonType } from "./types";

export type Stat = "atk" | "def" | "spa" | "spd" | "spe" | "acc" | "eva";
export type StatusCondition = "brn" | "psn" | "par" | "slp";

export interface StatChange { stat: Stat; stages: number; target: "self" | "foe" }

export interface MoveData {
  id: string;
  name: string;
  type: PokemonType;
  /** 0 = status move. */
  power: number;
  /** null = never misses. */
  accuracy: number | null;
  pp: number;
  priority?: number;
  /** Inflicted status; for damaging moves rolled with `chance`. */
  status?: StatusCondition;
  stats?: StatChange[];
  /** % chance for secondary effects (status / stats) of damaging moves. Status moves always apply. */
  chance?: number;
  flinch?: number;
  drain?: number;
  recoil?: number;
  highCrit?: boolean;
  rest?: boolean;
  desc: string;
}

const m = (d: MoveData) => d;

export const MOVES: Record<string, MoveData> = Object.fromEntries([
  // Normal
  m({ id: "tackle", name: "Tackle", type: "Normal", power: 35, accuracy: 95, pp: 35, desc: "Lao vào húc đối thủ." }),
  m({ id: "scratch", name: "Scratch", type: "Normal", power: 40, accuracy: 100, pp: 35, desc: "Cào bằng móng sắc." }),
  m({ id: "pound", name: "Pound", type: "Normal", power: 40, accuracy: 100, pp: 35, desc: "Đập bằng chân hoặc đuôi." }),
  m({ id: "quick-attack", name: "Quick Attack", type: "Normal", power: 40, accuracy: 100, pp: 30, priority: 1, desc: "Luôn ra đòn trước." }),
  m({ id: "headbutt", name: "Headbutt", type: "Normal", power: 70, accuracy: 100, pp: 15, flinch: 30, desc: "Húc đầu, 30% làm đối thủ chùn bước." }),
  m({ id: "body-slam", name: "Body Slam", type: "Normal", power: 85, accuracy: 100, pp: 15, status: "par", chance: 30, desc: "Đè cả thân, 30% gây tê liệt." }),
  m({ id: "hyper-fang", name: "Hyper Fang", type: "Normal", power: 80, accuracy: 90, pp: 15, flinch: 10, desc: "Cắn bằng răng nanh sắc." }),
  m({ id: "slash", name: "Slash", type: "Normal", power: 70, accuracy: 100, pp: 20, highCrit: true, desc: "Chém, dễ chí mạng." }),
  m({ id: "growl", name: "Growl", type: "Normal", power: 0, accuracy: 100, pp: 40, stats: [{ stat: "atk", stages: -1, target: "foe" }], desc: "Giảm Tấn công đối thủ." }),
  m({ id: "tail-whip", name: "Tail Whip", type: "Normal", power: 0, accuracy: 100, pp: 30, stats: [{ stat: "def", stages: -1, target: "foe" }], desc: "Giảm Phòng thủ đối thủ." }),
  m({ id: "leer", name: "Leer", type: "Normal", power: 0, accuracy: 100, pp: 30, stats: [{ stat: "def", stages: -1, target: "foe" }], desc: "Ánh mắt đáng sợ, giảm Phòng thủ." }),
  m({ id: "harden", name: "Harden", type: "Normal", power: 0, accuracy: null, pp: 30, stats: [{ stat: "def", stages: 1, target: "self" }], desc: "Tăng Phòng thủ." }),
  m({ id: "defense-curl", name: "Defense Curl", type: "Normal", power: 0, accuracy: null, pp: 40, stats: [{ stat: "def", stages: 1, target: "self" }], desc: "Cuộn tròn, tăng Phòng thủ." }),
  m({ id: "swords-dance", name: "Swords Dance", type: "Normal", power: 0, accuracy: null, pp: 30, stats: [{ stat: "atk", stages: 2, target: "self" }], desc: "Tăng mạnh Tấn công." }),
  m({ id: "smokescreen", name: "Smokescreen", type: "Normal", power: 0, accuracy: 100, pp: 20, stats: [{ stat: "acc", stages: -1, target: "foe" }], desc: "Giảm độ chính xác đối thủ." }),
  m({ id: "focus-energy", name: "Focus Energy", type: "Normal", power: 0, accuracy: null, pp: 30, stats: [{ stat: "atk", stages: 1, target: "self" }], desc: "Tập trung, tăng Tấn công." }),
  // Fire
  m({ id: "ember", name: "Ember", type: "Fire", power: 40, accuracy: 100, pp: 25, status: "brn", chance: 10, desc: "Đốm lửa nhỏ, 10% gây bỏng." }),
  m({ id: "flame-wheel", name: "Flame Wheel", type: "Fire", power: 60, accuracy: 100, pp: 25, status: "brn", chance: 10, desc: "Bánh xe lửa, 10% gây bỏng." }),
  m({ id: "flamethrower", name: "Flamethrower", type: "Fire", power: 95, accuracy: 100, pp: 15, status: "brn", chance: 10, desc: "Phun lửa dữ dội, 10% gây bỏng." }),
  m({ id: "fire-spin", name: "Fire Spin", type: "Fire", power: 35, accuracy: 85, pp: 15, desc: "Xoáy lửa thiêu đốt." }),
  m({ id: "will-o-wisp", name: "Will-O-Wisp", type: "Fire", power: 0, accuracy: 75, pp: 15, status: "brn", desc: "Ngọn lửa ma, gây bỏng." }),
  // Water
  m({ id: "bubble", name: "Bubble", type: "Water", power: 20, accuracy: 100, pp: 30, stats: [{ stat: "spe", stages: -1, target: "foe" }], chance: 10, desc: "Bong bóng, có thể giảm Tốc độ." }),
  m({ id: "water-gun", name: "Water Gun", type: "Water", power: 40, accuracy: 100, pp: 25, desc: "Phun nước." }),
  m({ id: "bubble-beam", name: "Bubble Beam", type: "Water", power: 65, accuracy: 100, pp: 20, stats: [{ stat: "spe", stages: -1, target: "foe" }], chance: 10, desc: "Tia bong bóng, có thể giảm Tốc độ." }),
  m({ id: "water-pulse", name: "Water Pulse", type: "Water", power: 60, accuracy: 100, pp: 20, desc: "Sóng nước." }),
  m({ id: "surf", name: "Surf", type: "Water", power: 95, accuracy: 100, pp: 15, desc: "Sóng lớn cuốn phăng đối thủ." }),
  m({ id: "hydro-pump", name: "Hydro Pump", type: "Water", power: 120, accuracy: 80, pp: 5, desc: "Vòi nước cực mạnh." }),
  m({ id: "withdraw", name: "Withdraw", type: "Water", power: 0, accuracy: null, pp: 40, stats: [{ stat: "def", stages: 1, target: "self" }], desc: "Rụt vào mai, tăng Phòng thủ." }),
  m({ id: "splash", name: "Splash", type: "Normal", power: 0, accuracy: null, pp: 40, desc: "Nhảy tưng tưng… không có gì xảy ra." }),
  // Electric
  m({ id: "thunder-shock", name: "Thunder Shock", type: "Electric", power: 40, accuracy: 100, pp: 30, status: "par", chance: 10, desc: "Điện giật, 10% gây tê liệt." }),
  m({ id: "spark", name: "Spark", type: "Electric", power: 65, accuracy: 100, pp: 20, status: "par", chance: 30, desc: "Lao vào với điện, 30% tê liệt." }),
  m({ id: "thunderbolt", name: "Thunderbolt", type: "Electric", power: 95, accuracy: 100, pp: 15, status: "par", chance: 10, desc: "Sấm sét mạnh, 10% tê liệt." }),
  m({ id: "thunder-wave", name: "Thunder Wave", type: "Electric", power: 0, accuracy: 100, pp: 20, status: "par", desc: "Sóng điện gây tê liệt." }),
  m({ id: "agility", name: "Agility", type: "Psychic", power: 0, accuracy: null, pp: 30, stats: [{ stat: "spe", stages: 2, target: "self" }], desc: "Tăng mạnh Tốc độ." }),
  // Grass
  m({ id: "absorb", name: "Absorb", type: "Grass", power: 20, accuracy: 100, pp: 20, drain: 0.5, desc: "Hút HP đối thủ." }),
  m({ id: "mega-drain", name: "Mega Drain", type: "Grass", power: 40, accuracy: 100, pp: 10, drain: 0.5, desc: "Hút nhiều HP đối thủ." }),
  m({ id: "vine-whip", name: "Vine Whip", type: "Grass", power: 35, accuracy: 100, pp: 10, desc: "Quất bằng dây leo." }),
  m({ id: "razor-leaf", name: "Razor Leaf", type: "Grass", power: 55, accuracy: 95, pp: 25, highCrit: true, desc: "Lá sắc như dao, dễ chí mạng." }),
  m({ id: "petal-dance", name: "Petal Dance", type: "Grass", power: 70, accuracy: 100, pp: 20, desc: "Vũ điệu cánh hoa." }),
  m({ id: "solar-beam", name: "Solar Beam", type: "Grass", power: 100, accuracy: 100, pp: 10, desc: "Tia năng lượng mặt trời." }),
  m({ id: "sleep-powder", name: "Sleep Powder", type: "Grass", power: 0, accuracy: 75, pp: 15, status: "slp", desc: "Phấn ngủ." }),
  m({ id: "stun-spore", name: "Stun Spore", type: "Grass", power: 0, accuracy: 75, pp: 30, status: "par", desc: "Bào tử gây tê liệt." }),
  m({ id: "growth", name: "Growth", type: "Normal", power: 0, accuracy: null, pp: 40, stats: [{ stat: "spa", stages: 1, target: "self" }], desc: "Tăng Tấn công đặc biệt." }),
  // Poison
  m({ id: "poison-sting", name: "Poison Sting", type: "Poison", power: 15, accuracy: 100, pp: 35, status: "psn", chance: 30, desc: "Kim độc, 30% gây độc." }),
  m({ id: "poison-powder", name: "Poison Powder", type: "Poison", power: 0, accuracy: 75, pp: 35, status: "psn", desc: "Phấn độc." }),
  m({ id: "acid", name: "Acid", type: "Poison", power: 40, accuracy: 100, pp: 30, stats: [{ stat: "def", stages: -1, target: "foe" }], chance: 10, desc: "Axit, có thể giảm Phòng thủ." }),
  m({ id: "sludge", name: "Sludge", type: "Poison", power: 65, accuracy: 100, pp: 20, status: "psn", chance: 30, desc: "Bùn độc, 30% gây độc." }),
  m({ id: "sludge-bomb", name: "Sludge Bomb", type: "Poison", power: 90, accuracy: 100, pp: 10, status: "psn", chance: 30, desc: "Bom bùn độc." }),
  // Flying
  m({ id: "gust", name: "Gust", type: "Flying", power: 40, accuracy: 100, pp: 35, desc: "Cơn gió mạnh." }),
  m({ id: "peck", name: "Peck", type: "Flying", power: 35, accuracy: 100, pp: 35, desc: "Mổ bằng mỏ." }),
  m({ id: "wing-attack", name: "Wing Attack", type: "Flying", power: 60, accuracy: 100, pp: 35, desc: "Đập bằng cánh." }),
  m({ id: "aerial-ace", name: "Aerial Ace", type: "Flying", power: 60, accuracy: null, pp: 20, desc: "Đòn bay không bao giờ trượt." }),
  m({ id: "air-cutter", name: "Air Cutter", type: "Flying", power: 55, accuracy: 95, pp: 25, highCrit: true, desc: "Lưỡi gió, dễ chí mạng." }),
  m({ id: "sand-attack", name: "Sand Attack", type: "Ground", power: 0, accuracy: 100, pp: 15, stats: [{ stat: "acc", stages: -1, target: "foe" }], desc: "Hất cát, giảm độ chính xác." }),
  // Bug
  m({ id: "string-shot", name: "String Shot", type: "Bug", power: 0, accuracy: 95, pp: 40, stats: [{ stat: "spe", stages: -1, target: "foe" }], desc: "Nhả tơ, giảm Tốc độ." }),
  m({ id: "leech-life", name: "Leech Life", type: "Bug", power: 20, accuracy: 100, pp: 15, drain: 0.5, desc: "Hút máu hồi HP." }),
  m({ id: "signal-beam", name: "Signal Beam", type: "Bug", power: 75, accuracy: 100, pp: 15, desc: "Tia tín hiệu kỳ lạ." }),
  m({ id: "silver-wind", name: "Silver Wind", type: "Bug", power: 60, accuracy: 100, pp: 5, desc: "Gió bạc từ phấn cánh." }),
  // Psychic
  m({ id: "confusion", name: "Confusion", type: "Psychic", power: 50, accuracy: 100, pp: 25, desc: "Sóng siêu linh." }),
  m({ id: "psybeam", name: "Psybeam", type: "Psychic", power: 65, accuracy: 100, pp: 20, desc: "Tia siêu linh." }),
  m({ id: "rest", name: "Rest", type: "Psychic", power: 0, accuracy: null, pp: 10, rest: true, desc: "Ngủ 2 lượt, hồi đầy HP." }),
  m({ id: "amnesia", name: "Amnesia", type: "Psychic", power: 0, accuracy: null, pp: 20, stats: [{ stat: "spd", stages: 2, target: "self" }], desc: "Tăng mạnh Phòng thủ đặc biệt." }),
  m({ id: "hypnosis", name: "Hypnosis", type: "Psychic", power: 0, accuracy: 60, pp: 20, status: "slp", desc: "Thôi miên gây ngủ." }),
  // Rock / Ground / Steel / Dark / Dragon / Fighting
  m({ id: "rock-throw", name: "Rock Throw", type: "Rock", power: 50, accuracy: 90, pp: 15, desc: "Ném đá." }),
  m({ id: "rock-tomb", name: "Rock Tomb", type: "Rock", power: 50, accuracy: 80, pp: 10, stats: [{ stat: "spe", stages: -1, target: "foe" }], chance: 100, desc: "Chôn bằng đá, giảm Tốc độ." }),
  m({ id: "rock-slide", name: "Rock Slide", type: "Rock", power: 75, accuracy: 90, pp: 10, flinch: 30, desc: "Đá lở." }),
  m({ id: "mud-slap", name: "Mud-Slap", type: "Ground", power: 20, accuracy: 100, pp: 10, stats: [{ stat: "acc", stages: -1, target: "foe" }], chance: 100, desc: "Ném bùn, giảm độ chính xác." }),
  m({ id: "magnitude", name: "Magnitude", type: "Ground", power: 70, accuracy: 100, pp: 30, desc: "Rung chấn mặt đất." }),
  m({ id: "earthquake", name: "Earthquake", type: "Ground", power: 100, accuracy: 100, pp: 10, desc: "Động đất cực mạnh." }),
  m({ id: "metal-claw", name: "Metal Claw", type: "Steel", power: 50, accuracy: 95, pp: 35, stats: [{ stat: "atk", stages: 1, target: "self" }], chance: 10, desc: "Móng thép, có thể tăng Tấn công." }),
  m({ id: "iron-defense", name: "Iron Defense", type: "Steel", power: 0, accuracy: null, pp: 15, stats: [{ stat: "def", stages: 2, target: "self" }], desc: "Tăng mạnh Phòng thủ." }),
  m({ id: "bite", name: "Bite", type: "Dark", power: 60, accuracy: 100, pp: 25, flinch: 30, desc: "Cắn, 30% làm chùn bước." }),
  m({ id: "crunch", name: "Crunch", type: "Dark", power: 80, accuracy: 100, pp: 15, stats: [{ stat: "spd", stages: -1, target: "foe" }], chance: 20, desc: "Nghiến nát." }),
  m({ id: "dragon-breath", name: "Dragon Breath", type: "Dragon", power: 60, accuracy: 100, pp: 20, status: "par", chance: 30, desc: "Hơi thở rồng, 30% tê liệt." }),
  m({ id: "dragon-rage", name: "Dragon Rage", type: "Dragon", power: 40, accuracy: 100, pp: 10, desc: "Cơn thịnh nộ của rồng." }),
  m({ id: "karate-chop", name: "Karate Chop", type: "Fighting", power: 50, accuracy: 100, pp: 25, highCrit: true, desc: "Chặt karate, dễ chí mạng." }),
  m({ id: "lick", name: "Lick", type: "Ghost", power: 20, accuracy: 100, pp: 30, status: "par", chance: 30, desc: "Liếm, 30% tê liệt." }),
].map((d) => [d.id, d]));

/** Used when every move is out of PP. */
export const STRUGGLE: MoveData = { id: "struggle", name: "Struggle", type: "Normal", power: 50, accuracy: null, pp: 1, recoil: 0.25, desc: "Đòn liều mạng khi hết PP." };

export const getMove = (id: string): MoveData => MOVES[id] ?? MOVES.tackle;
