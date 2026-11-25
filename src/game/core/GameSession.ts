import { START_MAP_ID } from "../data/maps";
import { getItem } from "../data/items";
import { getSpecies } from "../data/species";
import {
  createPokemon, displayName, evolve, healPokemon, itemEvolution, maxHp, type PokemonInstance,
} from "./pokemon";

export interface SaveData {
  version: number;
  playerName: string;
  mapId: string;
  position: { x: number; y: number } | null;
  money: number;
  party: PokemonInstance[];
  box: PokemonInstance[];
  bag: Record<string, number>;
  dex: { seen: number[]; caught: number[] };
  defeated: string[];
  badges: string[];
  unlockedAreas: string[];
  steps: number;
  starterChosen: boolean;
}

const KEY = "pixel-adventure-save-v1";
const VERSION = 3;
export const PARTY_MAX = 6;

type Listener = () => void;

function newGame(): SaveData {
  return {
    version: VERSION, playerName: "RED", mapId: START_MAP_ID, position: null, money: 3000,
    party: [], box: [], bag: { "poke-ball": 5, potion: 3 }, dex: { seen: [], caught: [] },
    defeated: [], badges: [], unlockedAreas: [START_MAP_ID], steps: 0, starterChosen: false,
  };
}

/** Old (v1/v2) saves stored `{speciesId, level, hp, xp}`; rebuild them as full Pokémon. */
function migrate(d: Record<string, unknown>): SaveData {
  const fresh = newGame();
  if (d.version === VERSION) return { ...fresh, ...(d as Partial<SaveData>) } as SaveData;
  const convert = (list: unknown) => (Array.isArray(list) ? list : [])
    .filter((c): c is { speciesId: string; level: number } => !!c && typeof c === "object" && "speciesId" in c)
    .map((c) => createPokemon(getSpecies(c.speciesId).id, Math.max(2, Math.min(100, Number(c.level) || 5))));
  const party = convert(d.party);
  return {
    ...fresh,
    party, box: convert(d.box),
    bag: { "poke-ball": Number(d.balls ?? 5), potion: Number(d.potions ?? 3) },
    defeated: Array.isArray(d.defeated) ? (d.defeated as string[]) : [],
    badges: d.badge ? ["forest"] : [],
    unlockedAreas: Array.isArray(d.unlockedAreas) ? (d.unlockedAreas as string[]) : fresh.unlockedAreas,
    steps: Number(d.steps ?? 0),
    starterChosen: party.length > 0,
    dex: { seen: party.map((p) => getSpecies(p.speciesId).dex), caught: party.map((p) => getSpecies(p.speciesId).dex) },
  };
}

/**
 * Single source of truth for player progress. Phaser scenes and React menus
 * both read and mutate it through these methods; listeners re-render the UI.
 * Persistence is isolated in load()/save() so it can move to IndexedDB/cloud.
 */
export class GameSession {
  data: SaveData = newGame();
  private listeners = new Set<Listener>();

  constructor() { this.load(); }

  on(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  changed() { this.save(); this.listeners.forEach((fn) => fn()); }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.data = raw ? migrate(JSON.parse(raw)) : newGame();
    } catch { this.data = newGame(); }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage disabled */ } }
  reset() { this.data = newGame(); this.changed(); }
  hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }

  get party() { return this.data.party; }
  get bag() { return this.data.bag; }

  count(item: string) { return this.data.bag[item] ?? 0; }
  addItem(item: string, n = 1) { this.data.bag[item] = this.count(item) + n; }
  takeItem(item: string, n = 1): boolean {
    if (this.count(item) < n) return false;
    this.data.bag[item] -= n;
    if (this.data.bag[item] <= 0) delete this.data.bag[item];
    return true;
  }

  markSeen(speciesId: string) {
    const dex = getSpecies(speciesId).dex;
    if (!this.data.dex.seen.includes(dex)) this.data.dex.seen.push(dex);
  }
  markCaught(speciesId: string) {
    this.markSeen(speciesId);
    const dex = getSpecies(speciesId).dex;
    if (!this.data.dex.caught.includes(dex)) this.data.dex.caught.push(dex);
  }

  addPokemon(mon: PokemonInstance): "party" | "box" {
    this.markCaught(mon.speciesId);
    if (this.data.party.length < PARTY_MAX) { this.data.party.push(mon); return "party"; }
    this.data.box.push(mon);
    return "box";
  }

  giveStarter(speciesId: string) {
    if (this.data.starterChosen) return;
    this.addPokemon(createPokemon(speciesId, 5));
    this.data.starterChosen = true;
    this.changed();
  }

  healAll() { this.data.party.forEach(healPokemon); }
  hasUsablePokemon() { return this.data.party.some((p) => p.hp > 0); }

  swapParty(a: number, b: number) {
    const p = this.data.party;
    if (!p[a] || !p[b]) return;
    [p[a], p[b]] = [p[b], p[a]];
    this.changed();
  }

  /** Swap a party member with a box Pokémon, or deposit/withdraw. */
  deposit(partyIdx: number): boolean {
    if (this.data.party.length <= 1) return false;
    const [mon] = this.data.party.splice(partyIdx, 1);
    this.data.box.push(mon);
    this.changed();
    return true;
  }
  withdraw(boxIdx: number): boolean {
    if (this.data.party.length >= PARTY_MAX) return false;
    const [mon] = this.data.box.splice(boxIdx, 1);
    this.data.party.push(mon);
    this.changed();
    return true;
  }

  buy(item: string, qty: number): string {
    const data = getItem(item);
    if (!data || qty <= 0) return "Không thể mua.";
    const cost = data.price * qty;
    if (this.data.money < cost) return "Bạn không đủ tiền!";
    this.data.money -= cost;
    this.addItem(item, qty);
    this.changed();
    return `Đã mua ${qty} ${data.name}.`;
  }

  /**
   * Uses a medicine / status item / evolution stone outside battle.
   * Returns the message to show and whether an item was consumed.
   */
  useItemOn(itemId: string, partyIdx: number): { ok: boolean; message: string; evolvedInto?: string } {
    const item = getItem(itemId), mon = this.data.party[partyIdx];
    if (!item || !mon || this.count(itemId) <= 0) return { ok: false, message: "Không thể dùng." };
    const name = displayName(mon);
    const result = applyItem(item.id, mon);
    if (result.ok) {
      this.takeItem(itemId);
      if (result.evolvedInto) this.markCaught(result.evolvedInto);
      this.changed();
    }
    return { ...result, message: result.message.replace("{name}", name) };
  }
}

/** Shared item rules for overworld and battle use. */
export function applyItem(itemId: string, mon: PokemonInstance): { ok: boolean; message: string; evolvedInto?: string } {
  const item = getItem(itemId);
  if (!item) return { ok: false, message: "Không thể dùng." };
  if (item.category === "medicine") {
    if (mon.hp <= 0) return { ok: false, message: "{name} đã kiệt sức, không thể dùng." };
    const max = maxHp(mon);
    if (mon.hp >= max) return { ok: false, message: "HP của {name} đã đầy." };
    const healed = Math.min(max, mon.hp + (item.heal ?? 0)) - mon.hp;
    mon.hp += healed;
    return { ok: true, message: `{name} hồi ${healed} HP.` };
  }
  if (item.category === "status") {
    if (!mon.status || (item.cures !== "all" && item.cures !== mon.status)) return { ok: false, message: "Không có tác dụng." };
    mon.status = null; mon.sleepTurns = 0;
    return { ok: true, message: "{name} đã khỏe lại!" };
  }
  if (item.category === "evolution") {
    const into = itemEvolution(mon, item.id);
    if (!into) return { ok: false, message: "Không có tác dụng." };
    const before = getSpecies(mon.speciesId).name;
    evolve(mon, into);
    return { ok: true, message: `${before} đã tiến hóa thành ${getSpecies(into).name}!`, evolvedInto: into };
  }
  return { ok: false, message: "Chỉ dùng được trong trận đấu." };
}

export const session = new GameSession();
