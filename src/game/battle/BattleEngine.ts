import { STRUGGLE, getMove, type MoveData, type Stat, type StatusCondition } from "../data/moves";
import { getItem } from "../data/items";
import { getSpecies } from "../data/species";
import { categoryOf, effectiveness } from "../data/types";
import { applyItem } from "../core/GameSession";
import {
  calcStats, displayName, expForLevel, gainExp, levelEvolution, maxHp, slot, type PokemonInstance,
} from "../core/pokemon";
import { random, type RandomService } from "../services/RandomService";
import type { CharacterLook } from "../world/types";
import { AI_GUARD, AI_ULTIMATE, chooseMove } from "./ai";
import {
  ENERGY_MAX, ENERGY_REGEN, ENERGY_START, GUARD_ENERGY, SURGE_MAX, elementOf, energyCost, reactionFor, ultimateFrom, type Element,
} from "./elements";
import {
  accuracyMultiplier, bondChance, calcDamage, catchShakes, effectiveSpeed, expYield, freshStages, ultimateEff, type Stages,
} from "./formulas";

export type Side = "player" | "foe";
export type Outcome = "win" | "lose" | "run" | "caught";

/** Lightweight snapshot the UI renders from. */
export interface MonView {
  uid: string; speciesId: string; name: string; level: number; hp: number; maxHp: number;
  status: StatusCondition | null; expFrac: number; shiny: boolean;
}

export type BattleEvent =
  | { kind: "text"; text: string }
  | { kind: "move"; side: Side; move: MoveData }
  | { kind: "hit"; side: Side; eff: number; damage?: number; crit?: boolean }
  | { kind: "hp"; side: Side; hp: number; maxHp: number }
  | { kind: "status"; side: Side; status: StatusCondition | null }
  | { kind: "stat"; side: Side; up: boolean }
  | { kind: "faint"; side: Side }
  | { kind: "sendOut"; side: Side; mon: MonView }
  | { kind: "recall"; side: Side }
  | { kind: "ball"; ball: string; shakes: number; caught: boolean }
  | { kind: "exp"; uid: string; from: number; to: number }
  | { kind: "levelUp"; uid: string; mon: MonView }
  | { kind: "learn"; uid: string; moveId: string }
  | { kind: "energy"; side: Side; energy: number; surge: number }
  | { kind: "mark"; side: Side; mark: Element | null; turns: number }
  | { kind: "reaction"; side: Side; name: string; color: number }
  | { kind: "guard"; side: Side }
  | { kind: "ultimate"; side: Side; move: MoveData }
  | { kind: "end"; outcome: Outcome };

export type PlayerAction =
  /** `timing` = damage multiplier earned in the rhythm check (1, 1.15 or 1.3). */
  | { type: "move"; index: number; timing?: number }
  | { type: "ultimate"; timing?: number }
  | { type: "guard" }
  | { type: "switch"; index: number }
  | { type: "item"; itemId: string; target?: number }
  /** Bond (capture) with a crystal; `bonus` multiplies its strength (rhythm minigame). */
  | { type: "bond"; itemId: string; bonus: number }
  | { type: "run" };

export interface BattleSetup {
  kind: "wild" | "trainer";
  playerParty: PokemonInstance[];
  foeParty: PokemonInstance[];
  trainerName?: string;
  /** Overworld look of the trainer, drawn during the battle intro. */
  trainerLook?: CharacterLook;
  /** Base prize; money = prize × level of the trainer's last Pokémon. */
  prize?: number;
  bag: { count(id: string): number; take(id: string): boolean };
  onCaught(mon: PokemonInstance): "party" | "box";
  onSeen(speciesId: string): void;
  onEvolved?(speciesId: string): void;
  hasCaught?(speciesId: string): boolean;
  /** Boss battles: the foe starts with half a Surge gauge and always plays smart. */
  boss?: boolean;
  rng?: RandomService;
}

interface Battler {
  mon: PokemonInstance; stages: Stages; flinched: boolean; fainted: boolean;
  confused: number; seeded: boolean; protecting: boolean; focus: boolean; turns: number;
  mark: Element | null; markTurns: number; guarding: boolean; protectChain: number;
}
/** Energy and Surge belong to the side (trainer), so switching keeps them. */
interface SideState { reflect: number; lightscreen: number; energy: number; surge: number }

const FATIGUE_TURN = 40;

const STAT_NAME: Record<Stat, string> = { atk: "Tấn công", def: "Phòng thủ", spa: "Tấn công Đ.biệt", spd: "Phòng thủ Đ.biệt", spe: "Tốc độ", acc: "Độ chính xác", eva: "Né tránh" };

/** Flail / Reversal power from remaining HP (Gen 3 table). */
function lowHpPower(mon: PokemonInstance) {
  const p = Math.floor((48 * mon.hp) / maxHp(mon));
  return p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20;
}

export function viewOf(mon: PokemonInstance): MonView {
  const growth = getSpecies(mon.speciesId).growth;
  const lo = expForLevel(growth, mon.level), hi = expForLevel(growth, mon.level + 1);
  return {
    uid: mon.uid, speciesId: mon.speciesId, name: displayName(mon), level: mon.level, hp: mon.hp, maxHp: maxHp(mon),
    status: mon.status, shiny: !!mon.shiny, expFrac: hi > lo ? Math.max(0, Math.min(1, (mon.exp - lo) / (hi - lo))) : 1,
  };
}

/**
 * Pure turn-based battle logic. Takes player decisions, mutates the Pokémon
 * objects (so party HP/EXP persist) and returns an ordered event list that
 * the BattleScene plays back as text and animation.
 */
export class BattleEngine {
  phase: "action" | "forceSwitch" | "over" = "action";
  outcome: Outcome | null = null;
  prizeMoney = 0;
  readonly leveled = new Set<string>();
  private p!: Battler;
  private f!: Battler;
  private participants = new Set<string>();
  private runAttempts = 0;
  /** Turn counter; past FATIGUE_TURN the arena drains both sides so every battle ends. */
  private turn = 0;
  private moved = new Set<Side>();
  private rng: RandomService;

  constructor(readonly setup: BattleSetup) {
    this.rng = setup.rng ?? random;
  }

  get isTrainer() { return this.setup.kind === "trainer"; }
  get playerMon() { return this.p.mon; }
  get foeMon() { return this.f.mon; }
  get playerIndex() { return this.setup.playerParty.indexOf(this.p.mon); }

  intro(): BattleEvent[] {
    const ev: BattleEvent[] = [];
    const firstFoe = this.setup.foeParty[0];
    const lead = this.setup.playerParty.find((m) => m.hp > 0) ?? this.setup.playerParty[0];
    this.f = this.battler(firstFoe);
    this.p = this.battler(lead);
    this.participants.add(lead.uid);
    this.setup.onSeen(firstFoe.speciesId);
    if (this.setup.boss) this.sides.foe.surge = SURGE_MAX / 2;
    if (this.isTrainer) {
      ev.push({ kind: "text", text: `${this.setup.trainerName} muốn thách đấu!` });
      ev.push({ kind: "sendOut", side: "foe", mon: viewOf(firstFoe) });
      ev.push({ kind: "text", text: `${this.setup.trainerName} gửi ra ${displayName(firstFoe)}!` });
    } else {
      ev.push({ kind: "sendOut", side: "foe", mon: viewOf(firstFoe) });
      ev.push({ kind: "text", text: firstFoe.shiny ? `✦ Một ${displayName(firstFoe)} SHINY xuất hiện! ✦` : `${displayName(firstFoe)} hoang dã xuất hiện!` });
    }
    ev.push({ kind: "text", text: `Tiến lên! ${displayName(lead)}!` });
    ev.push({ kind: "sendOut", side: "player", mon: viewOf(lead) });
    ev.push(this.energyEvent("player"), this.energyEvent("foe"));
    return ev;
  }

  /* ------------------------------------------------------------ */
  /* Queries for the UI                                           */
  /* ------------------------------------------------------------ */

  energy(s: Side) { return this.sides[s].energy; }
  /** Dev/demo only: fill a side's Energy and Surge. */
  debugCharge(s: Side) { this.sides[s].energy = ENERGY_MAX; this.sides[s].surge = SURGE_MAX; }
  surge(s: Side) { return this.sides[s].surge; }
  surgeReady(s: Side) { return this.sides[s].surge >= SURGE_MAX; }
  markOf(s: Side) { const b = this.side(s); return b ? { mark: b.mark, turns: b.markTurns } : { mark: null, turns: 0 }; }
  ultimateMove(s: Side) {
    const mon = this.side(s).mon;
    return ultimateFrom(mon.moves.map((m) => getMove(m.id)), getSpecies(mon.speciesId).types);
  }
  /** Odds shown before a bond attempt, so capture is legible instead of a gamble. */
  bondOdds(itemId: string, bonus = 1) {
    return bondChance(this.f.mon, (getItem(itemId)?.ball ?? 1) * bonus);
  }
  /** Reaction the given move would trigger on the current foe. */
  previewReaction(moveId: string) {
    const el = elementOf(getMove(moveId)), mark = this.f.mark;
    return el && mark ? reactionFor(mark, el) : null;
  }

  private energyEvent(s: Side): BattleEvent {
    return { kind: "energy", side: s, energy: this.sides[s].energy, surge: this.sides[s].surge };
  }
  private gainSurge(s: Side, amount: number) {
    this.sides[s].surge = Math.max(0, Math.min(SURGE_MAX, this.sides[s].surge + amount));
  }

  /* ------------------------------------------------------------ */
  /* Turns                                                        */
  /* ------------------------------------------------------------ */

  act(action: PlayerAction): BattleEvent[] {
    if (this.phase !== "action") return [];
    const ev: BattleEvent[] = [];
    this.turn++;
    this.moved.clear();
    this.p.flinched = this.f.flinched = false;
    this.p.protecting = this.f.protecting = false;
    this.p.guarding = this.f.guarding = false;
    const foeMove = chooseMove(this.rng, this.f.mon, this.f.stages, this.p.mon, this.isTrainer || !!this.setup.boss, {
      energy: this.sides.foe.energy, surgeReady: this.surgeReady("foe"), targetMark: this.p.mark, threatReady: this.surgeReady("player"),
    });
    // Guarding always happens before anything else in the turn.
    if (foeMove === AI_GUARD) this.guard("foe", ev);
    const foeAct = () => { if (foeMove !== AI_GUARD) this.useMove("foe", foeMove, ev); };

    if (action.type === "run") {
      if (this.isTrainer) return [{ kind: "text", text: "Không thể bỏ chạy khỏi trận đấu với Trainer!" }];
      this.runAttempts++;
      const ps = effectiveSpeed(this.p.mon, this.p.stages), fs = effectiveSpeed(this.f.mon, this.f.stages);
      const odds = Math.floor((ps * 128) / Math.max(1, fs)) + 30 * this.runAttempts;
      if (ps >= fs || this.rng.int(0, 255) < odds) {
        ev.push({ kind: "text", text: "Bạn đã chạy thoát an toàn!" });
        return this.finish(ev, "run");
      }
      ev.push({ kind: "text", text: "Không thể chạy thoát!" });
      foeAct();
    } else if (action.type === "guard") {
      this.guard("player", ev);
      foeAct();
    } else if (action.type === "switch") {
      const next = this.setup.playerParty[action.index];
      if (!next || next.hp <= 0 || next === this.p.mon) return [];
      ev.push({ kind: "text", text: `${displayName(this.p.mon)}, quay về!` }, { kind: "recall", side: "player" });
      this.switchIn(next, ev);
      foeAct();
    } else if (action.type === "item" || action.type === "bond") {
      const used = action.type === "bond"
        ? this.bond(action.itemId, action.bonus, ev)
        : this.useItem(action.itemId, action.target ?? this.playerIndex, ev);
      if (!used) return ev;
      if ((this.phase as string) === "over") return ev;
      foeAct();
    } else {
      let pIdx: number;
      if (action.type === "ultimate") {
        if (!this.surgeReady("player")) return [{ kind: "text", text: "Thanh Bộc Phát chưa đầy!" }];
        pIdx = AI_ULTIMATE;
      } else {
        const pMove = this.p.mon.moves[action.index];
        if (!pMove) return [];
        if (energyCost(getMove(pMove.id)) > this.sides.player.energy) return [{ kind: "text", text: "Không đủ Năng lượng! Hãy THỦ để tích năng lượng." }];
        pIdx = action.index;
      }
      const timing = action.timing ?? 1;
      const pri = (side: Side, idx: number) => idx === AI_ULTIMATE ? 1 : idx >= 0 ? getMove(this.side(side).mon.moves[idx].id).priority ?? 0 : 0;
      const pPri = pri("player", pIdx), fPri = pri("foe", foeMove);
      const ps = effectiveSpeed(this.p.mon, this.p.stages), fs = effectiveSpeed(this.f.mon, this.f.stages);
      const playerFirst = pPri !== fPri ? pPri > fPri : ps !== fs ? ps > fs : this.rng.chance(0.5);
      if (playerFirst) { this.useMove("player", pIdx, ev, timing); foeAct(); }
      else { foeAct(); this.useMove("player", pIdx, ev, timing); }
    }

    this.residual(ev);
    this.resolveFaints(ev);
    return ev;
  }

  /** THỦ: halve incoming damage this turn and bank extra energy. */
  private guard(side: Side, ev: BattleEvent[]) {
    const b = this.side(side), st = this.sides[side];
    if (b.fainted) return;
    b.guarding = true;
    st.energy = Math.min(ENERGY_MAX, st.energy + GUARD_ENERGY);
    this.gainSurge(side, 6);
    this.moved.add(side);
    ev.push({ kind: "guard", side }, { kind: "text", text: `${this.label(side)} vào thế THỦ và tích tụ năng lượng!` }, this.energyEvent(side));
  }

  /** After the active Pokémon faints the player must pick a replacement. */
  forceSwitch(index: number): BattleEvent[] {
    const next = this.setup.playerParty[index];
    if (this.phase !== "forceSwitch" || !next || next.hp <= 0) return [];
    const ev: BattleEvent[] = [];
    this.switchIn(next, ev);
    this.phase = "action";
    return ev;
  }

  /** Resolve a "learn move" prompt. `replace` = slot index to forget, or null to skip. */
  learnMove(uid: string, moveId: string, replace: number | null): BattleEvent[] {
    const mon = this.setup.playerParty.find((m) => m.uid === uid);
    if (!mon) return [];
    const name = displayName(mon), move = getMove(moveId);
    if (replace === null || !mon.moves[replace]) return [{ kind: "text", text: `${name} đã không học ${move.name}.` }];
    const old = getMove(mon.moves[replace].id).name;
    mon.moves[replace] = slot(moveId);
    return [
      { kind: "text", text: `1, 2, và… Bụp! ${name} đã quên ${old}.` },
      { kind: "text", text: `Và… ${name} đã học được ${move.name}!` },
    ];
  }

  /** Party members that leveled during the battle and now meet a level evolution. */
  pendingEvolutions(): { mon: PokemonInstance; into: string }[] {
    if (this.outcome === "lose") return [];
    return this.setup.playerParty
      .filter((m) => this.leveled.has(m.uid) && m.hp > 0)
      .map((mon) => ({ mon, into: levelEvolution(mon) }))
      .filter((e): e is { mon: PokemonInstance; into: string } => !!e.into);
  }

  /* ------------------------------------------------------------ */
  /* Internals                                                    */
  /* ------------------------------------------------------------ */

  private battler(mon: PokemonInstance): Battler {
    return {
      mon, stages: freshStages(), flinched: false, fainted: mon.hp <= 0, confused: 0, seeded: false, protecting: false, focus: false, turns: 0,
      mark: null, markTurns: 0, guarding: false, protectChain: 0,
    };
  }
  private sides: Record<Side, SideState> = {
    player: { reflect: 0, lightscreen: 0, energy: ENERGY_START, surge: 0 },
    foe: { reflect: 0, lightscreen: 0, energy: ENERGY_START, surge: 0 },
  };

  private setMark(s: Side, mark: Element | null, ev: BattleEvent[], turns = 3) {
    const b = this.side(s);
    b.mark = mark; b.markTurns = mark ? turns : 0;
    ev.push({ kind: "mark", side: s, mark, turns: b.markTurns });
  }
  private side(s: Side) { return s === "player" ? this.p : this.f; }
  private other(s: Side): Side { return s === "player" ? "foe" : "player"; }
  private label(s: Side) {
    const name = displayName(this.side(s).mon);
    return s === "foe" ? (this.isTrainer ? `${name} của đối thủ` : `${name} hoang dã`) : name;
  }

  private switchIn(mon: PokemonInstance, ev: BattleEvent[]) {
    this.p = this.battler(mon);
    this.participants.add(mon.uid);
    ev.push({ kind: "text", text: `Tiến lên! ${displayName(mon)}!` }, { kind: "sendOut", side: "player", mon: viewOf(mon) });
  }

  private setHp(s: Side, hp: number, ev: BattleEvent[]) {
    const b = this.side(s);
    b.mon.hp = Math.max(0, Math.min(maxHp(b.mon), hp));
    ev.push({ kind: "hp", side: s, hp: b.mon.hp, maxHp: maxHp(b.mon) });
  }

  private checkFaint(s: Side, ev: BattleEvent[]) {
    const b = this.side(s);
    if (b.mon.hp > 0 || b.fainted) return;
    b.fainted = true;
    b.mon.status = null;
    ev.push({ kind: "faint", side: s }, { kind: "text", text: `${this.label(s)} đã gục ngã!` });
  }

  private useMove(side: Side, index: number, ev: BattleEvent[], timing = 1) {
    const user = this.side(side), foeSide = this.other(side), target = this.side(foeSide);
    if (user.fainted || target.fainted || this.phase === "over") return;
    const name = this.label(side);
    this.moved.add(side);

    // Pre-move status checks
    if (user.mon.status === "slp") {
      if (user.mon.sleepTurns > 0) {
        user.mon.sleepTurns--;
        ev.push({ kind: "text", text: `${name} đang ngủ say.` });
        return;
      }
      user.mon.status = null;
      ev.push({ kind: "text", text: `${name} đã tỉnh dậy!` }, { kind: "status", side, status: null });
    }
    if (user.mon.status === "frz") {
      if (!this.rng.chance(0.2)) { ev.push({ kind: "text", text: `${name} bị đóng băng cứng!` }); return; }
      user.mon.status = null;
      ev.push({ kind: "text", text: `${name} đã tan băng!` }, { kind: "status", side, status: null });
    }
    if (user.flinched) { ev.push({ kind: "text", text: `${name} chùn bước, không thể ra đòn!` }); return; }
    if (user.confused > 0) {
      user.confused--;
      if (user.confused === 0) ev.push({ kind: "text", text: `${name} đã hết rối loạn!` });
      else {
        ev.push({ kind: "text", text: `${name} đang rối loạn!` });
        if (this.rng.chance(0.5)) {
          const st = calcStats(user.mon);
          const dmg = Math.max(1, Math.floor(Math.floor((Math.floor((2 * user.mon.level) / 5) + 2) * 40 * st.atk / st.def) / 50) + 2);
          ev.push({ kind: "text", text: "Nó tự tấn công chính mình trong lúc rối loạn!" }, { kind: "hit", side, eff: 1, damage: Math.min(user.mon.hp, dmg) });
          this.setHp(side, user.mon.hp - dmg, ev);
          this.checkFaint(side, ev);
          return;
        }
      }
    }
    if (user.mon.status === "par" && this.rng.chance(0.25)) {
      ev.push({ kind: "text", text: `${name} bị tê liệt, không thể cử động!` });
      return;
    }

    const st = this.sides[side];
    const ultimate = index === AI_ULTIMATE;
    const slotRef = index >= 0 ? user.mon.moves[index] : undefined;
    const move = ultimate ? this.ultimateMove(side) : slotRef ? getMove(slotRef.id) : STRUGGLE;
    if (ultimate) {
      st.surge = 0;
      ev.push({ kind: "ultimate", side, move }, this.energyEvent(side), { kind: "text", text: `${name} giải phóng TUYỆT KỸ: ${move.name}!` });
    } else {
      const cost = energyCost(move);
      if (cost > st.energy) { ev.push({ kind: "text", text: `${name} không đủ năng lượng!` }); return; }
      st.energy -= cost;
      if (cost) ev.push(this.energyEvent(side));
      if (!slotRef) ev.push({ kind: "text", text: `${name} đã hết chiêu!` });
      ev.push({ kind: "text", text: `${name} dùng ${move.name}!` });
    }
    if (!move.protect) user.protectChain = 0;
    const firstTurn = user.turns === 0;
    user.turns++;

    const selfOnly = move.power === 0 && !move.status && !move.confuse && !move.leechSeed && !move.flee
      && (move.stats?.every((s) => s.target === "self") ?? true);
    if (!selfOnly && target.protecting) { ev.push({ kind: "text", text: `${this.label(foeSide)} đã tự bảo vệ!` }); return; }
    if (move.firstTurn && !firstTurn) { ev.push({ kind: "text", text: "Nhưng thất bại!" }); return; }
    if (move.requiresSleep && target.mon.status !== "slp") { ev.push({ kind: "text", text: `${this.label(foeSide)} không bị ảnh hưởng!` }); return; }

    // Accuracy (OHKO moves: 30% + level difference)
    if (move.ohko && user.mon.level < target.mon.level) { ev.push({ kind: "text", text: "Nhưng thất bại!" }); return; }
    const baseAcc = move.ohko ? 30 + (user.mon.level - target.mon.level) : move.accuracy;
    if (baseAcc !== null && !selfOnly) {
      const acc = move.ohko ? baseAcc : baseAcc * accuracyMultiplier(user.stages.acc - target.stages.eva);
      if (this.rng.float() * 100 >= acc) { ev.push({ kind: "text", text: "Nhưng đòn đánh đã trượt!" }); return; }
    }

    ev.push({ kind: "move", side, move });

    const damaging = move.power > 0 || move.fixedDamage !== undefined || move.ohko;
    const el = elementOf(move);
    if (!damaging) {
      this.statusMove(side, move, ev);
      // Elemental status moves still leave a mark: setup has value.
      if (!selfOnly && el && !target.fainted && !target.mark) this.setMark(foeSide, el, ev);
      return;
    }

    const targetName = this.label(foeSide);
    const types = getSpecies(target.mon.speciesId).types;
    const eff = move.id === "struggle" ? 1 : ultimateEff(move, effectiveness(move.type, types));
    if (eff === 0) { ev.push({ kind: "text", text: `Không có tác dụng với ${targetName}…` }); return; }
    const reaction = el && target.mark ? reactionFor(target.mark, el) : null;
    let mult = timing * (reaction?.mult ?? 1) * (target.guarding ? 0.5 : 1);
    if (ultimate && target.guarding) mult *= 0.8; // a braced target shrugs off even more of an ultimate

    let dealtTotal = 0, crit = false, hits = 0;
    const totalHits = move.multiHit ? this.rollHits(move.multiHit) : 1;
    for (let h = 0; h < totalHits && !target.fainted; h++) {
      let dmg: number;
      let hitCrit = false;
      if (move.ohko) dmg = target.mon.hp;
      else if (move.fixedDamage === "level") dmg = user.mon.level;
      else if (move.fixedDamage === "half") dmg = Math.max(1, Math.floor(target.mon.hp / 2));
      else if (typeof move.fixedDamage === "number") dmg = move.fixedDamage;
      else {
        const physical = categoryOf(move.type) === "physical";
        const screen = physical ? this.sides[foeSide].reflect > 0 : this.sides[foeSide].lightscreen > 0;
        const res = calcDamage(this.rng, move, user.mon, user.stages, target.mon, target.stages, {
          critStage: user.focus ? 2 : 0, screen, power: move.lowHpPower ? lowHpPower(user.mon) : undefined, mult,
        });
        dmg = res.damage;
        hitCrit = res.crit;
        crit ||= res.crit;
      }
      const dealt = Math.min(target.mon.hp, dmg);
      dealtTotal += dealt;
      hits++;
      ev.push({ kind: "hit", side: foeSide, eff, damage: dealt, crit: hitCrit });
      this.setHp(foeSide, target.mon.hp - dealt, ev);
      if (target.mon.hp <= 0) break;
    }
    if (reaction) ev.push({ kind: "reaction", side: foeSide, name: reaction.name, color: reaction.color });
    if (target.guarding) ev.push({ kind: "text", text: `${targetName} đã THỦ, giảm sát thương!` });
    if (timing >= 1.3) ev.push({ kind: "text", text: "Nhịp HOÀN HẢO! Sát thương tăng mạnh!" });
    // Surge: dealing and taking damage both charge the ultimate.
    // Tuned so an ultimate comes roughly every 5 turns of an even fight.
    if (!ultimate) this.gainSurge(side, 4 + (dealtTotal / maxHp(target.mon)) * 30 + (reaction ? 12 : 0) + (timing >= 1.3 ? 5 : 0));
    this.gainSurge(foeSide, (dealtTotal / maxHp(target.mon)) * 36);
    ev.push(this.energyEvent(side), this.energyEvent(foeSide));
    if (move.multiHit) ev.push({ kind: "text", text: `Trúng ${hits} lần!` });
    if (move.ohko) ev.push({ kind: "text", text: "Đòn hạ gục một chiêu!" });
    if (crit) ev.push({ kind: "text", text: "Đòn chí mạng!" });
    if (!move.fixedDamage && !move.ohko) {
      if (eff > 1) ev.push({ kind: "text", text: "Hiệu quả cực tốt!" });
      else if (eff < 1) ev.push({ kind: "text", text: "Không hiệu quả lắm…" });
    }
    if (target.mon.status === "frz" && move.type === "Fire" && target.mon.hp > 0) {
      target.mon.status = null;
      ev.push({ kind: "status", side: foeSide, status: null }, { kind: "text", text: `${targetName} đã tan băng!` });
    }

    if (move.drain && dealtTotal > 0 && user.mon.hp < maxHp(user.mon)) {
      this.setHp(side, user.mon.hp + Math.max(1, Math.floor(dealtTotal * move.drain)), ev);
      ev.push({ kind: "text", text: `${targetName} bị hút mất năng lượng!` });
    }
    if (move.recoil && dealtTotal > 0) {
      this.setHp(side, user.mon.hp - Math.max(1, Math.floor(dealtTotal * move.recoil)), ev);
      ev.push({ kind: "text", text: `${name} bị phản đòn!` });
    }
    if (move.selfDestruct) this.setHp(side, 0, ev);
    if (reaction?.heal && dealtTotal > 0 && user.mon.hp > 0 && user.mon.hp < maxHp(user.mon)) {
      this.setHp(side, user.mon.hp + Math.max(1, Math.floor(dealtTotal * reaction.heal)), ev);
      ev.push({ kind: "text", text: `${name} hấp thụ sinh lực từ phản ứng!` });
    }
    this.checkFaint(foeSide, ev);
    this.checkFaint(side, ev);
    if (target.fainted || user.fainted) return;

    // Marks: a reaction consumes the mark; otherwise the hit leaves its own.
    if (reaction) {
      this.setMark(foeSide, null, ev);
      if (reaction.status && this.rng.chance(reaction.status.chance)) this.inflict(foeSide, reaction.status.cond, ev, false);
      if (reaction.debuff) this.changeStat(foeSide, reaction.debuff.stat, reaction.debuff.stages, ev);
      if (reaction.confuse && this.rng.chance(reaction.confuse)) this.confuse(foeSide, ev, false);
    } else if (el) {
      this.setMark(foeSide, el, ev);
    }

    // Secondary effects
    const chance = (move.chance ?? 100) / 100;
    if (move.status && this.rng.chance(chance)) this.inflict(foeSide, move.status, ev, false);
    if (move.confuse && this.rng.chance(chance)) this.confuse(foeSide, ev, false);
    if (move.stats && this.rng.chance(chance)) for (const st of move.stats) this.changeStat(st.target === "self" ? side : foeSide, st.stat, st.stages, ev);
    if (move.flinch && !this.moved.has(foeSide) && this.rng.chance(move.flinch / 100)) target.flinched = true;
  }

  private rollHits([min, max]: [number, number]) {
    if (min === max) return min;
    // Gen 3 distribution for 2–5 hit moves: 37.5 / 37.5 / 12.5 / 12.5 %
    const r = this.rng.float();
    return r < 0.375 ? 2 : r < 0.75 ? 3 : r < 0.875 ? 4 : 5;
  }

  private statusMove(side: Side, move: MoveData, ev: BattleEvent[]) {
    const user = this.side(side), foeSide = this.other(side), target = this.side(foeSide);
    if (move.rest) {
      if (user.mon.hp >= maxHp(user.mon)) { ev.push({ kind: "text", text: "Nhưng thất bại!" }); return; }
      user.mon.status = "slp"; user.mon.sleepTurns = 2;
      ev.push({ kind: "status", side, status: "slp" }, { kind: "text", text: `${this.label(side)} ngủ và hồi phục sức khỏe!` });
      this.setHp(side, maxHp(user.mon), ev);
      return;
    }
    if (move.heal) {
      if (user.mon.hp >= maxHp(user.mon)) { ev.push({ kind: "text", text: "HP đã đầy rồi!" }); return; }
      this.setHp(side, user.mon.hp + Math.floor(maxHp(user.mon) * move.heal), ev);
      ev.push({ kind: "text", text: `${this.label(side)} đã hồi phục HP!` });
      return;
    }
    if (move.flee) {
      if (this.isTrainer) { ev.push({ kind: "text", text: "Nhưng thất bại!" }); return; }
      ev.push({ kind: "text", text: side === "player" ? "Bạn đã rời khỏi trận đấu!" : `${this.label(side)} đã bỏ chạy!` });
      this.finish(ev, "run");
      return;
    }
    if (move.protect) {
      // Consecutive Protects get harder (1, 1/3, 1/9...), so stalling can't loop forever.
      if (this.moved.has(foeSide) || !this.rng.chance(1 / Math.pow(3, user.protectChain))) {
        user.protectChain = 0;
        ev.push({ kind: "text", text: "Nhưng thất bại!" });
        return;
      }
      user.protectChain++;
      user.protecting = true;
      ev.push({ kind: "text", text: `${this.label(side)} vào thế phòng thủ!` });
      return;
    }
    if (move.screen) {
      const s = this.sides[side];
      if (s[move.screen] > 0) { ev.push({ kind: "text", text: "Nhưng thất bại!" }); return; }
      s[move.screen] = 5;
      ev.push({ kind: "stat", side, up: true }, { kind: "text", text: move.screen === "reflect" ? "Reflect giúp giảm sát thương vật lý!" : "Light Screen giúp giảm sát thương đặc biệt!" });
      return;
    }
    if (move.haze) {
      this.p.stages = freshStages(); this.f.stages = freshStages();
      ev.push({ kind: "text", text: "Mọi thay đổi chỉ số đã bị xóa!" });
      return;
    }
    if (move.focus) {
      if (user.focus) { ev.push({ kind: "text", text: "Nhưng thất bại!" }); return; }
      user.focus = true;
      ev.push({ kind: "text", text: `${this.label(side)} đang tập trung cao độ!` });
      return;
    }
    if (move.leechSeed) {
      if (target.seeded || getSpecies(target.mon.speciesId).types.includes("Grass")) { ev.push({ kind: "text", text: `${this.label(foeSide)} không bị ảnh hưởng!` }); return; }
      target.seeded = true;
      ev.push({ kind: "text", text: `${this.label(foeSide)} bị gieo hạt!` });
      return;
    }
    if (move.status || move.confuse) {
      if (move.status && effectiveness(move.type, getSpecies(target.mon.speciesId).types) === 0 && move.type === "Electric") {
        ev.push({ kind: "text", text: `Không có tác dụng với ${this.label(foeSide)}…` });
        return;
      }
      if (move.status) this.inflict(foeSide, move.status, ev, true);
      if (move.confuse) this.confuse(foeSide, ev, !move.status);
      if (move.stats) for (const st of move.stats) this.changeStat(st.target === "self" ? side : foeSide, st.stat, st.stages, ev);
      return;
    }
    if (move.stats) {
      for (const st of move.stats) this.changeStat(st.target === "self" ? side : foeSide, st.stat, st.stages, ev);
      return;
    }
    if (move.splash) { ev.push({ kind: "text", text: "Nhưng không có gì xảy ra!" }); return; }
    ev.push({ kind: "text", text: "Nhưng không có gì xảy ra!" });
  }

  private confuse(s: Side, ev: BattleEvent[], announceFail: boolean) {
    const b = this.side(s);
    if (b.confused > 0 || b.fainted) { if (announceFail) ev.push({ kind: "text", text: `${this.label(s)} đã rối loạn sẵn rồi!` }); return; }
    b.confused = this.rng.int(2, 5);
    ev.push({ kind: "stat", side: s, up: false }, { kind: "text", text: `${this.label(s)} bị rối loạn!` });
  }

  private inflict(s: Side, status: StatusCondition, ev: BattleEvent[], announceFail: boolean) {
    const b = this.side(s), types = getSpecies(b.mon.speciesId).types;
    const immune = (status === "brn" && types.includes("Fire")) || (status === "frz" && types.includes("Ice"))
      || (status === "psn" && (types.includes("Poison") || types.includes("Steel")));
    if (b.mon.status || immune || b.fainted) {
      if (announceFail) ev.push({ kind: "text", text: b.mon.status ? `${this.label(s)} đã có trạng thái rồi!` : "Nhưng thất bại!" });
      return;
    }
    b.mon.status = status;
    if (status === "slp") b.mon.sleepTurns = this.rng.int(1, 3);
    const text = { brn: "bị bỏng!", psn: "bị trúng độc!", par: "bị tê liệt! Có thể không cử động được!", slp: "đã ngủ thiếp đi!", frz: "bị đóng băng!" }[status];
    ev.push({ kind: "status", side: s, status }, { kind: "text", text: `${this.label(s)} ${text}` });
  }

  private changeStat(s: Side, stat: Stat, stages: number, ev: BattleEvent[]) {
    const b = this.side(s);
    const before = b.stages[stat];
    const after = Math.max(-6, Math.min(6, before + stages));
    const who = `${STAT_NAME[stat]} của ${this.label(s)}`;
    if (after === before) { ev.push({ kind: "text", text: `${who} không thể ${stages > 0 ? "tăng" : "giảm"} thêm!` }); return; }
    b.stages[stat] = after;
    const amount = Math.abs(after - before) >= 2 ? (stages > 0 ? "tăng mạnh" : "giảm mạnh") : stages > 0 ? "tăng" : "giảm";
    ev.push({ kind: "stat", side: s, up: stages > 0 }, { kind: "text", text: `${who} ${amount}!` });
  }

  private residual(ev: BattleEvent[]) {
    // Stalemate breaker (replaces PP/Struggle): from turn 40 the arena drains both actives, growing each turn.
    if (this.turn > FATIGUE_TURN && this.phase !== "over") {
      if (this.turn === FATIGUE_TURN + 1) ev.push({ kind: "text", text: "Linh khí sân đấu bắt đầu cạn kiệt! Cả hai bên đều mất sức mỗi lượt." });
      for (const s of ["player", "foe"] as Side[]) {
        const b = this.side(s);
        if (b.fainted) continue;
        const dmg = Math.min(b.mon.hp, Math.max(1, Math.floor((maxHp(b.mon) * (this.turn - FATIGUE_TURN)) / 16)));
        ev.push({ kind: "hit", side: s, eff: 1, damage: dmg });
        this.setHp(s, b.mon.hp - dmg, ev);
        this.checkFaint(s, ev);
      }
    }
    for (const s of ["player", "foe"] as Side[]) {
      const b = this.side(s);
      if (b.fainted || this.phase === "over") continue;
      if (b.mon.status === "brn" || b.mon.status === "psn") {
        const dmg = Math.max(1, Math.floor(maxHp(b.mon) / 8));
        ev.push({ kind: "text", text: `${this.label(s)} bị ${b.mon.status === "brn" ? "bỏng" : "độc"} gây sát thương!` });
        ev.push({ kind: "hit", side: s, eff: 1, damage: Math.min(b.mon.hp, dmg) });
        this.setHp(s, b.mon.hp - dmg, ev);
        this.checkFaint(s, ev);
      }
      const other = this.side(this.other(s));
      if (b.seeded && !b.fainted && !other.fainted) {
        const dmg = Math.min(b.mon.hp, Math.max(1, Math.floor(maxHp(b.mon) / 8)));
        ev.push({ kind: "text", text: `Hạt giống hút HP của ${this.label(s)}!` }, { kind: "hit", side: s, eff: 1, damage: dmg });
        this.setHp(s, b.mon.hp - dmg, ev);
        if (other.mon.hp < maxHp(other.mon)) this.setHp(this.other(s), other.mon.hp + dmg, ev);
        this.checkFaint(s, ev);
      }
    }
    for (const s of ["player", "foe"] as Side[]) {
      const st = this.sides[s], b = this.side(s);
      if (this.phase !== "over") {
        st.energy = Math.min(ENERGY_MAX, st.energy + ENERGY_REGEN);
        ev.push(this.energyEvent(s));
      }
      if (b.mark && !b.fainted && --b.markTurns <= 0) {
        ev.push({ kind: "text", text: `Dấu ấn trên ${this.label(s)} đã tan biến.` });
        this.setMark(s, null, ev);
      }
      for (const k of ["reflect", "lightscreen"] as const) {
        if (st[k] > 0 && --st[k] === 0) ev.push({ kind: "text", text: `${k === "reflect" ? "Reflect" : "Light Screen"} ${s === "player" ? "của bạn" : "của đối thủ"} đã hết tác dụng.` });
      }
    }
  }

  private resolveFaints(ev: BattleEvent[]) {
    if (this.phase === "over") return;
    if (this.f.fainted) {
      this.awardExp(this.f.mon, ev);
      const next = this.setup.foeParty.find((m) => m.hp > 0);
      if (next) {
        this.f = this.battler(next);
        this.setup.onSeen(next.speciesId);
        this.participants = new Set(this.p.fainted ? [] : [this.p.mon.uid]);
        ev.push({ kind: "text", text: `${this.setup.trainerName} gửi ra ${displayName(next)}!` }, { kind: "sendOut", side: "foe", mon: viewOf(next) });
      } else {
        if (this.isTrainer) {
          const last = this.setup.foeParty[this.setup.foeParty.length - 1];
          this.prizeMoney = (this.setup.prize ?? 0) * last.level;
          ev.push({ kind: "text", text: `Bạn đã đánh bại ${this.setup.trainerName}!` });
          if (this.prizeMoney > 0) ev.push({ kind: "text", text: `Bạn nhận được ₽${this.prizeMoney} tiền thưởng!` });
        }
        this.finish(ev, "win");
        return;
      }
    }
    if (this.p.fainted) {
      if (!this.setup.playerParty.some((m) => m.hp > 0)) {
        ev.push({ kind: "text", text: "Bạn không còn Pokémon nào có thể chiến đấu!" }, { kind: "text", text: "Bạn đã bất tỉnh…" });
        this.finish(ev, "lose");
        return;
      }
      this.phase = "forceSwitch";
    }
  }

  private awardExp(foe: PokemonInstance, ev: BattleEvent[]) {
    const winners = this.setup.playerParty.filter((m) => this.participants.has(m.uid) && m.hp > 0);
    if (!winners.length) return;
    const amount = expYield(foe, this.isTrainer, winners.length);
    for (const mon of winners) {
      const before = viewOf(mon);
      const growth = getSpecies(mon.speciesId).growth;
      ev.push({ kind: "text", text: `${displayName(mon)} nhận được ${amount} điểm EXP.!` });
      const levels = gainExp(mon, amount);
      if (!levels.length) {
        ev.push({ kind: "exp", uid: mon.uid, from: before.expFrac, to: viewOf(mon).expFrac });
        continue;
      }
      ev.push({ kind: "exp", uid: mon.uid, from: before.expFrac, to: 1 });
      levels.forEach((lv, i) => {
        this.leveled.add(mon.uid);
        const v = viewOf(mon);
        // Show the level reached at this step, not the final one.
        const stepView = { ...v, level: lv.level };
        ev.push({ kind: "levelUp", uid: mon.uid, mon: stepView });
        ev.push({ kind: "text", text: `${displayName(mon)} lên LV. ${lv.level}!` });
        for (const id of lv.learned) ev.push({ kind: "text", text: `${displayName(mon)} đã học được ${getMove(id).name}!` });
        for (const id of lv.pending) ev.push({ kind: "learn", uid: mon.uid, moveId: id });
        const isLast = i === levels.length - 1;
        const lo = expForLevel(growth, lv.level), hi = expForLevel(growth, lv.level + 1);
        ev.push({ kind: "exp", uid: mon.uid, from: 0, to: isLast ? Math.min(1, (mon.exp - lo) / Math.max(1, hi - lo)) : 1 });
      });
    }
  }

  private useItem(itemId: string, target: number, ev: BattleEvent[]): boolean {
    const item = getItem(itemId);
    if (!item || this.setup.bag.count(itemId) <= 0) { ev.push({ kind: "text", text: "Bạn không có vật phẩm này." }); return false; }
    if (item.category === "ball") return this.bond(itemId, 1, ev);
    if (item.category === "evolution") { ev.push({ kind: "text", text: "Không thể dùng vật phẩm này trong trận đấu." }); return false; }
    return this.useMedicine(itemId, target, ev);
  }

  /** KẾT NỐI: bond with a weakened wild creature through a crystal. */
  private bond(itemId: string, bonus: number, ev: BattleEvent[]): boolean {
    const item = getItem(itemId);
    if (!item || item.category !== "ball" || this.setup.bag.count(itemId) <= 0) { ev.push({ kind: "text", text: "Bạn không có Pha Lê Kết Nối." }); return false; }
    {
      if (this.isTrainer) { ev.push({ kind: "text", text: "Không thể kết nối với Pokémon của Trainer khác!" }); return false; }
      this.setup.bag.take(itemId);
      const shakes = catchShakes(this.rng, this.f.mon, (item.ball ?? 1) * Math.max(1, bonus));
      const caught = shakes >= 4;
      ev.push({ kind: "text", text: `Bạn giơ ${item.name} lên, luồng sáng kết nối vươn tới ${displayName(this.f.mon)}!` }, { kind: "ball", ball: itemId, shakes: Math.min(3, shakes), caught });
      if (caught) {
        this.f.mon.caughtBall = itemId;
        const where = this.setup.onCaught(this.f.mon);
        ev.push({ kind: "text", text: `Kết nối thành công! ${displayName(this.f.mon)} đã trở thành bạn đồng hành!` });
        ev.push({ kind: "text", text: `Dữ liệu ${displayName(this.f.mon)} đã được thêm vào Pokédex.` });
        if (where === "box") ev.push({ kind: "text", text: `Đội đã đầy, ${displayName(this.f.mon)} được gửi vào PC Box.` });
        this.finish(ev, "caught");
      } else {
        ev.push({ kind: "text", text: ["Sợi kết nối đứt ngay lập tức!", "Nó chần chừ… rồi giật lùi lại!", "Gần được rồi! Nó vẫn còn cảnh giác.", "Chỉ thiếu một nhịp nữa thôi!"][shakes] });
        ev.push({ kind: "text", text: "Mẹo: HP thấp, trạng thái bất lợi và nhịp chuẩn giúp kết nối dễ hơn." });
      }
      return true;
    }
  }

  private useMedicine(itemId: string, target: number, ev: BattleEvent[]): boolean {
    const item = getItem(itemId)!;
    const mon = this.setup.playerParty[target];
    if (!mon) return false;
    const res = applyItem(itemId, mon);
    if (!res.ok) { ev.push({ kind: "text", text: res.message.replace("{name}", displayName(mon)) }); return false; }
    this.setup.bag.take(itemId);
    ev.push({ kind: "text", text: `Bạn dùng ${item.name}.` });
    if (mon === this.p.mon) {
      ev.push({ kind: "hp", side: "player", hp: mon.hp, maxHp: maxHp(mon) }, { kind: "status", side: "player", status: mon.status });
    }
    ev.push({ kind: "text", text: res.message.replace("{name}", displayName(mon)) });
    return true;
  }

  private finish(ev: BattleEvent[], outcome: Outcome) {
    this.phase = "over";
    this.outcome = outcome;
    ev.push({ kind: "end", outcome });
    return ev;
  }

  /** Exposed for the UI: current stats of the active player Pokémon. */
  playerStats() { return calcStats(this.p.mon); }
}
