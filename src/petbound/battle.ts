import { ELEMENT_LABELS, SKILLS, getPet, petMaxHp } from "./catalog";
import type { BattlePet, BattleResult, BattleState, Element, PetInstance } from "./types";
import { createPet, xpGain } from "./catalog";
import type { WorldSave } from "./types";
const ADVANTAGE: Partial<Record<Element, Element>> = {
  Nature: "Tide", Tide: "Flame", Flame: "Nature", Storm: "Tide", Stone: "Storm",
  Gale: "Nature", Frost: "Gale", Light: "Shadow", Shadow: "Light",
};
export function multiplier(attack: Element, defend: Element) {
  if (ADVANTAGE[attack] === defend) return 1.6;
  if (ADVANTAGE[defend] === attack) return 0.72;
  return 1;
}
export function battlePet(instance: PetInstance): BattlePet {
  return { instance, currentHp: instance.hp, shield: 0, cooldowns: {}, boost: 0 };
}
export function createBattle(player: PetInstance, foe: PetInstance, source: BattleState["source"], stage?: number): BattleState {
  const p = battlePet({ ...player, hp: Math.max(1, player.hp) });
  const f = battlePet({ ...foe, hp: Math.max(1, foe.hp) });
  return {
    player: p, foe: f, turn: 1, log: [`${getPet(player.speciesId).name} bước vào đấu trường!`, `Đối thủ ${getPet(foe.speciesId).name} xuất hiện!`],
    over: false, won: false, source, stage,
  };
}
function attackPower(instance: PetInstance) {
  return getPet(instance.speciesId).base.attack + instance.level * 2.7;
}
function defensePower(instance: PetInstance) {
  return getPet(instance.speciesId).base.defense + instance.level * 1.9;
}
function hit(attacker: BattlePet, defender: BattlePet, skillId: string) {
  const skill = SKILLS[skillId];
  if (!skill) return { line: "Kỹ năng không hợp lệ.", damage: 0 };
  if (Math.random() * 100 > skill.accuracy) return { line: `${skill.name} trượt mục tiêu!`, damage: 0 };
  let damage = 0;
  if (skill.kind === "attack") {
    const raw = skill.power + attackPower(attacker.instance) * 0.58 - defensePower(defender.instance) * 0.24;
    const mult = multiplier(skill.element, getPet(defender.instance.speciesId).element);
    const crit = Math.random() < 0.09 ? 1.55 : 1;
    damage = Math.max(6, Math.floor(raw * mult * crit * (1 + attacker.boost / 100)));
    const absorbed = Math.min(defender.shield, damage);
    defender.shield -= absorbed;
    defender.currentHp = Math.max(0, defender.currentHp - (damage - absorbed));
    return { line: `${getPet(attacker.instance.speciesId).name} dùng ${skill.name}, gây ${damage} sát thương${mult > 1 ? " · Khắc hệ!" : mult < 1 ? " · Giảm hiệu quả" : ""}.`, damage };
  }
  if (skill.kind === "heal") {
    const amount = Math.floor(skill.power + attacker.instance.level * 2.2);
    attacker.currentHp = Math.min(petMaxHp(getPet(attacker.instance.speciesId), attacker.instance.level), attacker.currentHp + amount);
    return { line: `${getPet(attacker.instance.speciesId).name} dùng ${skill.name}, hồi ${amount} HP.`, damage: 0 };
  }
  if (skill.kind === "shield") {
    const amount = Math.floor(skill.power + attacker.instance.level * 2.4);
    attacker.shield += amount;
    return { line: `${getPet(attacker.instance.speciesId).name} tạo khiên ${amount} điểm.`, damage: 0 };
  }
  attacker.boost = Math.min(75, attacker.boost + skill.power);
  return { line: `${getPet(attacker.instance.speciesId).name} kích hoạt ${skill.name}, tăng sức mạnh!`, damage: 0 };
}
function cooldown(state: BattleState) {
  for (const pet of [state.player, state.foe]) for (const id of Object.keys(pet.cooldowns)) pet.cooldowns[id] = Math.max(0, pet.cooldowns[id] - 1);
}
export function performTurn(state: BattleState, skillId: string): BattleState {
  if (state.over) return state;
  const next: BattleState = {
    ...state, player: { ...state.player, cooldowns: { ...state.player.cooldowns } },
    foe: { ...state.foe, cooldowns: { ...state.foe.cooldowns } }, log: [...state.log],
  };
  const skill = SKILLS[skillId];
  if (!skill || next.player.cooldowns[skillId] > 0) return { ...next, log: [...next.log, "Kỹ năng đang hồi chiêu."] };
  const result = hit(next.player, next.foe, skillId);
  next.log.push(result.line);
  next.player.cooldowns[skillId] = skill.cooldown + 1;
  if (next.foe.currentHp <= 0) {
    next.over = true; next.won = true;
    next.log.push("CHIẾN THẮNG! Linh thú đối thủ đã rời đấu trường.");
    return next;
  }
  const enemySkills = getPet(next.foe.instance.speciesId).skills;
  const available = enemySkills.map(id => SKILLS[id]).filter(s => s && (next.foe.cooldowns[s.id] ?? 0) === 0);
  const enemySkill = (available.length ? available : enemySkills.map(id => SKILLS[id])).sort((a,b) => (b.power + (b.kind==="heal"?12:0)) - (a.power + (a.kind==="heal"?12:0)))[0];
  if (enemySkill) {
    const enemyResult = hit(next.foe, next.player, enemySkill.id);
    next.log.push("Đối thủ: " + enemyResult.line);
    next.foe.cooldowns[enemySkill.id] = enemySkill.cooldown + 1;
  }
  if (next.player.currentHp <= 0) {
    next.over = true; next.won = false;
    next.log.push("Đội hình kiệt sức. Hãy chăm sóc linh thú rồi thử lại.");
  }
  cooldown(next);
  next.turn++;
  return next;
}
export function applyBattleResult(data: WorldSave, state: BattleState): BattleResult {
  const own = data.pets.find(p => p.uid === state.player.instance.uid);
  if (own) {
    own.hp = Math.max(1, Math.floor(state.player.currentHp));
    own.bond = Math.min(100, own.bond + (state.won ? 3 : 1));
    if (state.won) xpGain(own, state.source === "boss" ? 85 : state.source === "stage" ? 54 : 32);
  }
  const xp = state.source === "boss" ? 85 : state.source === "stage" ? 54 : 32;
  const reward = state.won ? {
    won: true, xp, gold: 0, crystals: 0, stage: state.stage,
  } : { won: false, xp: 0, gold: 0, crystals: 0, stage: state.stage };
  if (state.won && state.stage) {
    data.highestStage = Math.max(data.highestStage, state.stage);
    data.stage = Math.max(data.stage, state.stage + 1);
    const boss = state.stage % 5 === 0;
    data.gold += 95 + state.stage * 24 + (boss ? 650 : 0);
    data.crystals += boss ? 140 : 25 + (state.stage % 3) * 5;
    data.essence += boss ? 3 : 1;
    if (state.stage === 5 && !data.unlockedZones.includes("emberwild")) data.unlockedZones.push("emberwild");
    if (state.stage === 10 && !data.unlockedZones.includes("moonfall")) data.unlockedZones.push("moonfall");
    if (state.stage === 15 && !data.unlockedZones.includes("skyreach")) data.unlockedZones.push("skyreach");
    if (state.stage === 20 && !data.unlockedZones.includes("abyssal")) data.unlockedZones.push("abyssal");
    if (state.stage === 25 && !data.unlockedZones.includes("astral")) data.unlockedZones.push("astral");
    reward.gold = 95 + state.stage * 24 + (boss ? 650 : 0);
    reward.crystals = boss ? 140 : 25 + (state.stage % 3) * 5;
  } else if (state.won) {
    data.gold += 55; data.crystals += 8; reward.gold = 55; reward.crystals = 8;
  }
  return reward;
}
export function enemyForStage(stage: number): PetInstance {
  const order = ["bramblet","pebblit","cindercub","rivermint","voltwing","zephyrin","frostlet","duskmote","thornox","umbrafang","crysthorn","glaciera","solflare","starfin"];
  const id = stage % 5 === 0 ? order[(stage / 5 + 8) % order.length] : order[(stage * 3 + Math.floor(stage / 4)) % order.length];
  const level = 3 + stage * 2;
  const pet = createPet(id, level);
  pet.hp = petMaxHp(getPet(id), level) + stage * 8;
  return pet;
}
export function enemyForZone(zone: string, level = 3): PetInstance {
  const pools: Record<string, string[]> = {
    everdawn:["bramblet","pebblit","cloudhare","cindercub"],
    emberwild:["cindercub","emberlynx","voltwing","thornox"],
    moonfall:["duskmote","nightling","lumenkit","frostlet"],
    skyreach:["zephyrin","stormhare","glaciera","starfin"],
    abyssal:["shellora","umbrafang","crysthorn","glaciera"],
    astral:["solflare","starfin","crysthorn","umbrafang"],
  };
  const pool = pools[zone] ?? pools.everdawn;
  const id = pool[Math.floor(Math.random() * pool.length)];
  return createPet(id, level);
}
