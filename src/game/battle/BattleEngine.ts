import { STRUGGLE, getMove, type MoveData, type Stat, type StatusCondition } from "../data/moves";
import { getItem } from "../data/items";
import { getSpecies } from "../data/species";
import { effectiveness } from "../data/types";
import { applyItem } from "../core/GameSession";
import {
  calcStats, displayName, expForLevel, gainExp, levelEvolution, maxHp, slot, type PokemonInstance,
} from "../core/pokemon";
import { random, type RandomService } from "../services/RandomService";
import { chooseMove } from "./ai";
import {
  accuracyMultiplier, calcDamage, catchShakes, effectiveSpeed, expYield, freshStages, type Stages,
} from "./formulas";

export type Side = "player" | "foe";
export type Outcome = "win" | "lose" | "run" | "caught";

/** Lightweight snapshot the UI renders from. */
export interface MonView {
  uid: string; speciesId: string; name: string; level: number; hp: number; maxHp: number;
  status: StatusCondition | null; expFrac: number;
}

export type BattleEvent =
  | { kind: "text"; text: string }
  | { kind: "move"; side: Side; move: MoveData }
  | { kind: "hit"; side: Side; eff: number }
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
  | { kind: "end"; outcome: Outcome };

export type PlayerAction =
  | { type: "move"; index: number }
  | { type: "switch"; index: number }
  | { type: "item"; itemId: string; target?: number }
  | { type: "run" };

export interface BattleSetup {
  kind: "wild" | "trainer";
  playerParty: PokemonInstance[];
  foeParty: PokemonInstance[];
  trainerName?: string;
  /** Base prize; money = prize × level of the trainer's last Pokémon. */
  prize?: number;
  bag: { count(id: string): number; take(id: string): boolean };
  onCaught(mon: PokemonInstance): "party" | "box";
  onSeen(speciesId: string): void;
  onEvolved?(speciesId: string): void;
  rng?: RandomService;
}

interface Battler { mon: PokemonInstance; stages: Stages; flinched: boolean; fainted: boolean }

const STAT_NAME: Record<Stat, string> = { atk: "Tấn công", def: "Phòng thủ", spa: "Tấn công Đ.biệt", spd: "Phòng thủ Đ.biệt", spe: "Tốc độ", acc: "Độ chính xác", eva: "Né tránh" };

export function viewOf(mon: PokemonInstance): MonView {
  const growth = getSpecies(mon.speciesId).growth;
  const lo = expForLevel(growth, mon.level), hi = expForLevel(growth, mon.level + 1);
  return {
    uid: mon.uid, speciesId: mon.speciesId, name: displayName(mon), level: mon.level, hp: mon.hp, maxHp: maxHp(mon),
    status: mon.status, expFrac: hi > lo ? Math.min(1, (mon.exp - lo) / (hi - lo)) : 1,
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
    if (this.isTrainer) {
      ev.push({ kind: "text", text: `${this.setup.trainerName} muốn thách đấu!` });
      ev.push({ kind: "sendOut", side: "foe", mon: viewOf(firstFoe) });
      ev.push({ kind: "text", text: `${this.setup.trainerName} gửi ra ${displayName(firstFoe)}!` });
    } else {
      ev.push({ kind: "sendOut", side: "foe", mon: viewOf(firstFoe) });
      ev.push({ kind: "text", text: `${displayName(firstFoe)} hoang dã xuất hiện!` });
    }
    ev.push({ kind: "text", text: `Tiến lên! ${displayName(lead)}!` });
    ev.push({ kind: "sendOut", side: "player", mon: viewOf(lead) });
    return ev;
  }

  /* ------------------------------------------------------------ */
  /* Turns                                                        */
  /* ------------------------------------------------------------ */

  act(action: PlayerAction): BattleEvent[] {
    if (this.phase !== "action") return [];
    const ev: BattleEvent[] = [];
    this.moved.clear();
    this.p.flinched = this.f.flinched = false;
    const foeMove = chooseMove(this.rng, this.f.mon, this.f.stages, this.p.mon, this.isTrainer);

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
      this.useMove("foe", foeMove, ev);
    } else if (action.type === "switch") {
      const next = this.setup.playerParty[action.index];
      if (!next || next.hp <= 0 || next === this.p.mon) return [];
      ev.push({ kind: "text", text: `${displayName(this.p.mon)}, quay về!` }, { kind: "recall", side: "player" });
      this.switchIn(next, ev);
      this.useMove("foe", foeMove, ev);
    } else if (action.type === "item") {
      const used = this.useItem(action.itemId, action.target ?? this.playerIndex, ev);
      if (!used) return ev;
      if ((this.phase as string) === "over") return ev;
      this.useMove("foe", foeMove, ev);
    } else {
      const pMove = this.p.mon.moves[action.index];
      const pIdx = pMove && pMove.pp > 0 ? action.index : this.p.mon.moves.some((m) => m.pp > 0) ? -2 : -1;
      if (pIdx === -2) return [{ kind: "text", text: "Chiêu này đã hết PP!" }];
      const pPri = pIdx >= 0 ? getMove(pMove.id).priority ?? 0 : 0;
      const fPri = foeMove >= 0 ? getMove(this.f.mon.moves[foeMove].id).priority ?? 0 : 0;
      const ps = effectiveSpeed(this.p.mon, this.p.stages), fs = effectiveSpeed(this.f.mon, this.f.stages);
      const playerFirst = pPri !== fPri ? pPri > fPri : ps !== fs ? ps > fs : this.rng.chance(0.5);
      const order: [Side, number][] = playerFirst ? [["player", pIdx], ["foe", foeMove]] : [["foe", foeMove], ["player", pIdx]];
      for (const [side, idx] of order) this.useMove(side, idx, ev);
    }

    this.residual(ev);
    this.resolveFaints(ev);
    return ev;
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

  private battler(mon: PokemonInstance): Battler { return { mon, stages: freshStages(), flinched: false, fainted: mon.hp <= 0 }; }
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

  private useMove(side: Side, index: number, ev: BattleEvent[]) {
    const user = this.side(side), target = this.side(this.other(side));
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
    if (user.flinched) { ev.push({ kind: "text", text: `${name} chùn bước, không thể ra đòn!` }); return; }
    if (user.mon.status === "par" && this.rng.chance(0.25)) {
      ev.push({ kind: "text", text: `${name} bị tê liệt, không thể cử động!` });
      return;
    }

    const slotRef = index >= 0 ? user.mon.moves[index] : undefined;
    const move = slotRef ? getMove(slotRef.id) : STRUGGLE;
    if (slotRef) slotRef.pp = Math.max(0, slotRef.pp - 1);
    if (!slotRef) ev.push({ kind: "text", text: `${name} đã hết chiêu!` });
    ev.push({ kind: "text", text: `${name} dùng ${move.name}!` });

    const selfOnly = move.power === 0 && !move.status && (move.stats?.every((s) => s.target === "self") ?? true);
    // Accuracy
    if (move.accuracy !== null && !selfOnly) {
      const acc = move.accuracy * accuracyMultiplier(user.stages.acc - target.stages.eva);
      if (this.rng.float() * 100 >= acc) { ev.push({ kind: "text", text: "Nhưng đòn đánh đã trượt!" }); return; }
    }

    ev.push({ kind: "move", side, move });

    if (move.power === 0) { this.statusMove(side, move, ev); return; }

    const res = calcDamage(this.rng, move, user.mon, user.stages, target.mon, target.stages);
    const targetName = this.label(this.other(side));
    if (res.eff === 0) { ev.push({ kind: "text", text: `Không có tác dụng với ${targetName}…` }); return; }
    const dealt = Math.min(target.mon.hp, res.damage);
    ev.push({ kind: "hit", side: this.other(side), eff: res.eff });
    this.setHp(this.other(side), target.mon.hp - dealt, ev);
    if (res.crit) ev.push({ kind: "text", text: "Đòn chí mạng!" });
    if (res.eff > 1) ev.push({ kind: "text", text: "Hiệu quả cực tốt!" });
    else if (res.eff < 1) ev.push({ kind: "text", text: "Không hiệu quả lắm…" });

    if (move.drain && dealt > 0 && user.mon.hp < maxHp(user.mon)) {
      this.setHp(side, user.mon.hp + Math.max(1, Math.floor(dealt * move.drain)), ev);
      ev.push({ kind: "text", text: `${targetName} bị hút mất năng lượng!` });
    }
    if (move.recoil && dealt > 0) {
      this.setHp(side, user.mon.hp - Math.max(1, Math.floor(dealt * move.recoil)), ev);
      ev.push({ kind: "text", text: `${name} bị phản đòn!` });
    }
    this.checkFaint(this.other(side), ev);
    this.checkFaint(side, ev);
    if (target.fainted) return;

    // Secondary effects
    const chance = (move.chance ?? 100) / 100;
    if (move.status && this.rng.chance(chance)) this.inflict(this.other(side), move.status, ev, false);
    if (move.stats && this.rng.chance(chance)) for (const st of move.stats) this.changeStat(st.target === "self" ? side : this.other(side), st.stat, st.stages, ev);
    if (move.flinch && !this.moved.has(this.other(side)) && this.rng.chance(move.flinch / 100)) target.flinched = true;
  }

  private statusMove(side: Side, move: MoveData, ev: BattleEvent[]) {
    const user = this.side(side), foeSide = this.other(side);
    if (move.rest) {
      if (user.mon.hp >= maxHp(user.mon)) { ev.push({ kind: "text", text: "Nhưng thất bại!" }); return; }
      user.mon.status = "slp"; user.mon.sleepTurns = 2;
      ev.push({ kind: "status", side, status: "slp" }, { kind: "text", text: `${this.label(side)} ngủ và hồi phục sức khỏe!` });
      this.setHp(side, maxHp(user.mon), ev);
      return;
    }
    if (move.status) {
      if (effectiveness(move.type, getSpecies(this.side(foeSide).mon.speciesId).types) === 0) {
        ev.push({ kind: "text", text: `Không có tác dụng với ${this.label(foeSide)}…` });
        return;
      }
      this.inflict(foeSide, move.status, ev, true);
      return;
    }
    if (move.stats) {
      for (const st of move.stats) this.changeStat(st.target === "self" ? side : foeSide, st.stat, st.stages, ev);
      return;
    }
    ev.push({ kind: "text", text: "Nhưng không có gì xảy ra!" });
  }

  private inflict(s: Side, status: StatusCondition, ev: BattleEvent[], announceFail: boolean) {
    const b = this.side(s), types = getSpecies(b.mon.speciesId).types;
    const immune = (status === "brn" && types.includes("Fire")) || (status === "psn" && (types.includes("Poison") || types.includes("Steel")));
    if (b.mon.status || immune || b.fainted) {
      if (announceFail) ev.push({ kind: "text", text: b.mon.status ? `${this.label(s)} đã có trạng thái rồi!` : "Nhưng thất bại!" });
      return;
    }
    b.mon.status = status;
    if (status === "slp") b.mon.sleepTurns = this.rng.int(1, 3);
    const text = { brn: "bị bỏng!", psn: "bị trúng độc!", par: "bị tê liệt! Có thể không cử động được!", slp: "đã ngủ thiếp đi!" }[status];
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
    for (const s of ["player", "foe"] as Side[]) {
      const b = this.side(s);
      if (b.fainted || this.phase === "over") continue;
      if (b.mon.status === "brn" || b.mon.status === "psn") {
        const dmg = Math.max(1, Math.floor(maxHp(b.mon) / 8));
        ev.push({ kind: "text", text: `${this.label(s)} bị ${b.mon.status === "brn" ? "bỏng" : "độc"} gây sát thương!` });
        ev.push({ kind: "hit", side: s, eff: 1 });
        this.setHp(s, b.mon.hp - dmg, ev);
        this.checkFaint(s, ev);
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
    if (item.category === "ball") {
      if (this.isTrainer) { ev.push({ kind: "text", text: "Không thể bắt Pokémon của Trainer khác!" }); return false; }
      this.setup.bag.take(itemId);
      const shakes = catchShakes(this.rng, this.f.mon, item.ball ?? 1);
      const caught = shakes >= 4;
      ev.push({ kind: "text", text: `Bạn ném ${item.name}!` }, { kind: "ball", ball: itemId, shakes: Math.min(3, shakes), caught });
      if (caught) {
        this.f.mon.caughtBall = itemId;
        const where = this.setup.onCaught(this.f.mon);
        ev.push({ kind: "text", text: `Tuyệt vời! Đã bắt được ${displayName(this.f.mon)}!` });
        ev.push({ kind: "text", text: `Dữ liệu ${displayName(this.f.mon)} đã được thêm vào Pokédex.` });
        if (where === "box") ev.push({ kind: "text", text: `Đội đã đầy, ${displayName(this.f.mon)} được gửi vào PC Box.` });
        this.finish(ev, "caught");
      } else {
        ev.push({ kind: "text", text: ["Ôi không! Pokémon đã thoát ra!", "Aaa! Suýt nữa thì bắt được!", "Tiếc quá! Gần được rồi!", "Chỉ thiếu chút nữa thôi!"][shakes] });
      }
      return true;
    }
    if (item.category === "evolution") { ev.push({ kind: "text", text: "Không thể dùng vật phẩm này trong trận đấu." }); return false; }
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
