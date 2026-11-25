import { createPet, getPet } from "./catalog";
import type { PetInstance, WorldSave } from "./types";

const KEY = "petbound-wildlands-save-v1";
function initialSave(): WorldSave {
  return {
    version: 1, playerName: "Người Nuôi", gold: 650, crystals: 500, essence: 0,
    pets: [], party: [], stage: 1, highestStage: 0, claimedStages: [],
    unlockedZones: ["everdawn"], questStep: 0, questRewards: [],
    inventory: { herb: 3, tonic: 2, trainingManual: 1 },
    settings: { music: true, effects: true }, lastSeen: Date.now(),
  };
}
function isPet(v: unknown): v is PetInstance {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<PetInstance>;
  return typeof p.uid === "string" && typeof p.speciesId === "string" && !!getPet(p.speciesId)
    && Number.isFinite(p.level) && Array.isArray(p.skills);
}
function normalize(raw: Partial<WorldSave>): WorldSave {
  const base = initialSave();
  const pets = Array.isArray(raw.pets) ? raw.pets.filter(isPet) : [];
  return {
    ...base, ...raw,
    pets: pets.map(p => ({
      ...p, level: Math.max(1, Math.min(60, Math.floor(p.level))),
      hp: Math.max(0, Math.min(9999, Number(p.hp) || 0)),
      bond: Math.max(0, Math.min(100, Number(p.bond) || 0)),
      skills: p.skills.filter(id => typeof id === "string").slice(0, 4),
    })),
    party: Array.isArray(raw.party) ? raw.party.filter(id => pets.some(p => p.uid === id)).slice(0, 3) : [],
    claimedStages: Array.isArray(raw.claimedStages) ? raw.claimedStages.filter(Number.isInteger) : [],
    unlockedZones: Array.isArray(raw.unlockedZones) ? [...new Set(["everdawn", ...raw.unlockedZones])] : ["everdawn"],
    questRewards: Array.isArray(raw.questRewards) ? raw.questRewards : [],
    inventory: { ...base.inventory, ...raw.inventory },
    settings: { ...base.settings, ...raw.settings },
    gold: Math.max(0, Number(raw.gold) || 0),
    crystals: Math.max(0, Number(raw.crystals) || 0),
    essence: Math.max(0, Number(raw.essence) || 0),
    highestStage: Math.max(0, Math.floor(Number(raw.highestStage) || 0)),
    stage: Math.max(1, Math.floor(Number(raw.stage) || 1)),
  };
}
export function loadSave(): WorldSave {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw) as Partial<WorldSave>) : initialSave();
  } catch {
    return initialSave();
  }
}
export function saveGame(data: WorldSave) {
  data.lastSeen = Date.now();
  localStorage.setItem(KEY, JSON.stringify(data));
}
export function addPet(data: WorldSave, pet: PetInstance) {
  data.pets.push(pet);
  if (data.party.length < 3) data.party.push(pet.uid);
}
export function findPet(data: WorldSave, uid: string) {
  return data.pets.find(p => p.uid === uid);
}
export function selectedParty(data: WorldSave) {
  return data.party.map(id => findPet(data, id)).filter((p): p is PetInstance => !!p);
}
export function grantLevelReward(data: WorldSave, stage: number) {
  const boss = stage % 5 === 0;
  data.gold += 95 + stage * 24 + (boss ? 650 : 0);
  data.crystals += boss ? 140 : 25 + (stage % 3) * 5;
  data.essence += boss ? 3 : 1;
  if (stage === 5 && !data.unlockedZones.includes("emberwild")) data.unlockedZones.push("emberwild");
  if (stage === 10 && !data.unlockedZones.includes("moonfall")) data.unlockedZones.push("moonfall");
  if (stage === 15 && !data.unlockedZones.includes("skyreach")) data.unlockedZones.push("skyreach");
  if (stage === 20 && !data.unlockedZones.includes("abyssal")) data.unlockedZones.push("abyssal");
  if (stage === 25 && !data.unlockedZones.includes("astral")) data.unlockedZones.push("astral");
  data.highestStage = Math.max(data.highestStage, stage);
  data.stage = Math.max(data.stage, stage + 1);
}
export function starterPet(data: WorldSave, id: string) {
  if (data.pets.length) return;
  const p = createPet(id, 4);
  addPet(data, p);
  data.questStep = 1;
}
