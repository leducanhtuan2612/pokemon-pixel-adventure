/**
 * Generates static Gen 3 data for the 151 Kanto Pokémon from @pkmn/dex
 * (MIT, Pokémon Showdown's data layer). Run: npm run gen:data
 * Output: src/game/data/generated/{species,moves}.json — committed, so the
 * game itself has no runtime dependency on @pkmn/dex.
 */
import { Dex } from "@pkmn/dex";
import { writeFileSync } from "node:fs";

const dex = Dex.forGen(3);
const OUT = new URL("../src/game/data/generated/", import.meta.url);
const TYPES_VI = { Normal: "Thường", Fire: "Lửa", Water: "Nước", Electric: "Điện", Grass: "Cỏ", Ice: "Băng", Fighting: "Giác đấu", Poison: "Độc", Ground: "Đất", Flying: "Bay", Psychic: "Siêu linh", Bug: "Bọ", Rock: "Đá", Ghost: "Ma", Dragon: "Rồng", Dark: "Bóng tối", Steel: "Thép" };
const STAT_VI = { atk: "Tấn công", def: "Phòng thủ", spa: "T.công Đ.biệt", spd: "P.thủ Đ.biệt", spe: "Tốc độ", accuracy: "Độ chính xác", evasion: "Né tránh" };
const STATUS_VI = { brn: "gây bỏng", psn: "gây độc", tox: "gây độc nặng", par: "gây tê liệt", slp: "gây ngủ", frz: "đóng băng" };
const STAT_KEY = { atk: "atk", def: "def", spa: "spa", spd: "spd", spe: "spe", accuracy: "acc", evasion: "eva" };
const LEGENDARY = new Set(["articuno", "zapdos", "moltres", "mewtwo", "mew"]);
const SLOW = new Set(["articuno", "zapdos", "moltres", "mewtwo", "dratini", "dragonair", "dragonite", "snorlax", "lapras", "magikarp", "gyarados", "tauros", "aerodactyl", "growlithe", "arcanine", "rhyhorn", "rhydon", "scyther", "pinsir", "ponyta", "rapidash"]);
const FAST = new Set(["clefairy", "clefable", "jigglypuff", "wigglytuff", "chansey"]);
const MEDIUM_SLOW = new Set(["bulbasaur", "ivysaur", "venusaur", "charmander", "charmeleon", "charizard", "squirtle", "wartortle", "blastoise", "pidgey", "pidgeotto", "pidgeot", "nidoranf", "nidorina", "nidoqueen", "nidoranm", "nidorino", "nidoking", "oddish", "gloom", "vileplume", "poliwag", "poliwhirl", "poliwrath", "abra", "kadabra", "alakazam", "machop", "machoke", "machamp", "bellsprout", "weepinbell", "victreebel", "geodude", "graveler", "golem", "gastly", "haunter", "gengar", "mew"]);

const pct = (n) => `${n}%`;
function moveDesc(m, d) {
  const parts = [];
  if (d.power && !d.lowHpPower) parts.push(`Sức mạnh ${d.power}.`);
  if (d.fixedDamage === "level") parts.push("Gây sát thương bằng cấp độ người dùng.");
  else if (d.fixedDamage === "half") parts.push("Cắt một nửa HP hiện tại của đối thủ.");
  else if (d.fixedDamage) parts.push(`Luôn gây ${d.fixedDamage} sát thương.`);
  if (d.ohko) parts.push("Hạ gục ngay lập tức nếu trúng.");
  if (d.multiHit) parts.push(`Đánh ${d.multiHit[0]}–${d.multiHit[1]} lần.`);
  if (d.priority > 0) parts.push("Luôn ra đòn trước.");
  if (d.highCrit) parts.push("Dễ chí mạng.");
  if (d.status) parts.push(d.power ? `${pct(d.chance ?? 100)} ${STATUS_VI[d.status]}.` : `${STATUS_VI[d.status][0].toUpperCase()}${STATUS_VI[d.status].slice(1)} đối thủ.`);
  if (d.confuse) parts.push(d.power ? `${pct(d.chance ?? 100)} gây rối loạn.` : "Gây rối loạn đối thủ.");
  for (const s of d.stats ?? []) {
    const who = s.target === "self" ? "bản thân" : "đối thủ";
    const how = s.stages > 0 ? (s.stages >= 2 ? "Tăng mạnh" : "Tăng") : s.stages <= -2 ? "Giảm mạnh" : "Giảm";
    parts.push(`${d.power && d.chance && d.chance < 100 ? pct(d.chance) + " " : ""}${how} ${STAT_VI[Object.keys(STAT_KEY).find((k) => STAT_KEY[k] === s.stat)]} ${who}.`);
  }
  if (d.flinch) parts.push(`${pct(d.flinch)} làm chùn bước.`);
  if (d.drain) parts.push("Hồi HP bằng nửa sát thương gây ra.");
  if (d.recoil) parts.push("Người dùng chịu phản đòn.");
  if (d.heal) parts.push("Hồi một nửa HP tối đa.");
  if (d.rest) parts.push("Ngủ 2 lượt và hồi đầy HP.");
  if (d.leechSeed) parts.push("Gieo hạt hút HP đối thủ mỗi lượt.");
  if (d.screen === "reflect") parts.push("Giảm nửa sát thương vật lý trong 5 lượt.");
  if (d.screen === "lightscreen") parts.push("Giảm nửa sát thương đặc biệt trong 5 lượt.");
  if (d.haze) parts.push("Xóa mọi thay đổi chỉ số.");
  if (d.protect) parts.push("Chặn đòn của đối thủ trong lượt này.");
  if (d.selfDestruct) parts.push("Người dùng gục ngã sau khi dùng.");
  if (d.focus) parts.push("Tăng khả năng chí mạng.");
  if (d.requiresSleep) parts.push("Chỉ có tác dụng khi đối thủ đang ngủ.");
  if (d.firstTurn) parts.push("Chỉ dùng được ở lượt đầu tiên.");
  if (d.lowHpPower) parts.push("Càng ít HP càng mạnh (tối đa 200).");
  if (d.flee) parts.push("Kết thúc trận đấu với Pokémon hoang dã.");
  if (d.splash) parts.push("Nhảy tưng tưng… không có gì xảy ra.");
  if (!parts.length) parts.push(d.unsupported ? "Chiêu đặc biệt (chưa có hiệu ứng trong bản này)." : `Chiêu hệ ${TYPES_VI[m.type]}.`);
  return parts.join(" ");
}

function convertMove(m) {
  const d = { id: m.id, name: m.name, type: m.type, power: m.basePower, accuracy: m.accuracy === true ? null : m.accuracy, pp: m.pp };
  if (m.priority) d.priority = m.priority;
  if (m.critRatio >= 2) d.highCrit = true;
  const status = m.status ?? m.secondary?.status;
  if (status) d.status = status === "tox" ? "psn" : status;
  const sec = m.secondary;
  if (sec?.chance && sec.chance < 100 && (sec.status || sec.boosts || sec.self || sec.volatileStatus === "confusion")) d.chance = sec.chance;
  const stats = [];
  const push = (boosts, target) => { for (const [k, v] of Object.entries(boosts ?? {})) stats.push({ stat: STAT_KEY[k], stages: v, target }); };
  if (m.boosts) push(m.boosts, m.target === "self" || m.target === "adjacentAllyOrSelf" || m.target === "allySide" ? "self" : "foe");
  if (sec?.boosts) push(sec.boosts, "foe");
  if (sec?.self?.boosts) push(sec.self.boosts, "self");
  if (m.self?.boosts) push(m.self.boosts, "self");
  if (stats.length) d.stats = stats;
  if (sec?.volatileStatus === "flinch") d.flinch = sec.chance;
  if (m.volatileStatus === "confusion" || sec?.volatileStatus === "confusion") d.confuse = true;
  if (m.drain) d.drain = m.drain[0] / m.drain[1];
  if (m.recoil) d.recoil = m.recoil[0] / m.recoil[1];
  if (m.multihit) d.multiHit = Array.isArray(m.multihit) ? m.multihit : [m.multihit, m.multihit];
  if (m.damage) d.fixedDamage = m.damage;
  if (m.ohko) d.ohko = true;
  if (m.heal || ["synthesis", "moonlight", "morningsun"].includes(m.id)) d.heal = 0.5;
  if (m.id === "rest") d.rest = true;
  if (m.volatileStatus === "leechseed") d.leechSeed = true;
  if (m.sideCondition === "reflect" || m.sideCondition === "lightscreen") d.screen = m.sideCondition;
  if (m.id === "haze") d.haze = true;
  if (m.volatileStatus === "protect") d.protect = true;
  if (m.selfdestruct === "always") d.selfDestruct = true;
  if (m.volatileStatus === "focusenergy") d.focus = true;
  if (m.id === "dreameater") d.requiresSleep = true;
  if (m.id === "fakeout") d.firstTurn = true;
  if (m.id === "swagger") d.stats = [{ stat: "atk", stages: 2, target: "foe" }];
  if (m.id === "flatter") d.stats = [{ stat: "spa", stages: 1, target: "foe" }];
  if (m.id === "bellydrum") { d.stats = [{ stat: "atk", stages: 6, target: "self" }]; }
  if (m.id === "curse") d.type = "Ghost";
  if (m.id === "curse") d.stats = [{ stat: "atk", stages: 1, target: "self" }, { stat: "def", stages: 1, target: "self" }, { stat: "spe", stages: -1, target: "self" }];
  // Variable-power moves get Gen 3 average/typical values.
  if (m.id === "magnitude") d.power = 71;
  if (m.id === "lowkick") d.power = 60;
  if (m.id === "flail" || m.id === "reversal") { d.power = 20; d.lowHpPower = true; }
  if (m.id === "superfang") d.fixedDamage = "half";
  if (["whirlwind", "roar", "teleport"].includes(m.id)) d.flee = true;
  if (m.id === "splash") d.splash = true;
  const handled = d.power || d.flee || d.splash || d.status || d.stats || d.confuse || d.heal || d.rest || d.leechSeed || d.screen || d.haze || d.protect || d.focus || d.fixedDamage || d.ohko;
  if (!handled) d.unsupported = true;
  d.desc = moveDesc(m, d);
  return d;
}

const species = [], moveIds = new Set(["struggle", "tackle"]);
for (let n = 1; n <= 151; n++) {
  const s = dex.species.all().find((x) => x.num === n && !x.forme);
  const ls = (await dex.learnsets.get(s.id)).learnset ?? {};
  const learnset = [];
  for (const [move, sources] of Object.entries(ls)) for (const src of sources) {
    const mm = /^3L(\d+)$/.exec(src);
    if (mm) { learnset.push([Number(mm[1]), move]); moveIds.add(move); }
  }
  // Same level: attacking moves first so the first move slot is always a usable attack.
  learnset.sort((a, b) => a[0] - b[0] || dex.moves.get(b[1]).basePower - dex.moves.get(a[1]).basePower || a[1].localeCompare(b[1]));
  const evolutions = [];
  for (const evoName of s.evos ?? []) {
    const e = dex.species.get(evoName);
    if (!e.exists || e.num > 151 || e.forme) continue;
    if (e.evoType === "useItem") evolutions.push({ kind: "item", item: e.evoItem.toLowerCase().replace(/ /g, "-"), into: e.id });
    else if (e.evoType === "trade") evolutions.push({ kind: "level", level: 37, into: e.id }); // trade → level 37 in single-player
    else if (e.evoLevel) evolutions.push({ kind: "level", level: e.evoLevel, into: e.id });
  }
  const stage = s.prevo ? (dex.species.get(s.prevo).prevo && dex.species.get(s.prevo).num <= 151 ? 3 : 2) : 1;
  const hasEvo = evolutions.length > 0;
  const bst = Object.values(s.baseStats).reduce((a, b) => a + b, 0);
  const legendary = LEGENDARY.has(s.id);
  const catchRate = legendary ? (s.id === "mew" ? 45 : 3) : !hasEvo && stage === 1 ? (bst >= 500 ? 25 : bst >= 450 ? 45 : 75)
    : stage === 1 ? (bst < 300 ? 255 : bst < 330 ? 190 : 120) : hasEvo ? 120 : (stage === 3 ? 45 : 75);
  const factor = legendary ? 0.45 : hasEvo ? (stage === 1 ? 0.2 : 0.28) : 0.36;
  species.push({
    id: s.id, dex: n, name: s.name, types: s.types, base: s.baseStats, catchRate,
    baseExp: Math.round(bst * factor),
    growth: SLOW.has(s.id) ? "slow" : FAST.has(s.id) ? "fast" : MEDIUM_SLOW.has(s.id) ? "mediumSlow" : "mediumFast",
    learnset, evolutions, weightKg: s.weightkg, rarity: legendary ? "legendary" : !hasEvo && stage === 1 && bst >= 450 ? "rare" : stage === 1 && hasEvo ? "common" : "uncommon",
  });
}
const moves = {};
for (const id of moveIds) { const m = dex.moves.get(id); if (m.exists) moves[id] = convertMove(m); }
writeFileSync(new URL("species.json", OUT), JSON.stringify(species));
writeFileSync(new URL("moves.json", OUT), JSON.stringify(moves));
const unsupported = Object.values(moves).filter((m) => m.unsupported).map((m) => m.id);
console.log(`species ${species.length}, moves ${Object.keys(moves).length}, unsupported ${unsupported.length}: ${unsupported.join(" ")}`);
