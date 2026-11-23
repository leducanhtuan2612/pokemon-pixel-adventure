import Phaser from "phaser";
import { getMap } from "../data/maps";
import { getSpecies, makeCreature, type Creature } from "../data/pokemon";
import { PlayerController } from "../entities/PlayerController";
import { loadSave, saveGame, type SaveData } from "../services/save";
import { EncounterSystem } from "../systems/EncounterSystem";
import { DialogBox } from "../ui/DialogBox";
import { WorldMap, type NpcRuntime } from "../world/WorldMap";
import type { Direction, NpcDef, Point, TeamMember } from "../world/types";

type Battle = { foe: Creature; queue: TeamMember[]; trainer?: NpcDef; boss: boolean; wild: boolean };

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

export class OverworldScene extends Phaser.Scene {
  private save!: SaveData;
  private world!: WorldMap;
  private player!: PlayerController;
  private dialog!: DialogBox;
  private encounters = new EncounterSystem();
  private started = false;

  private battle: Battle | null = null;
  private battleLayer: Phaser.GameObjects.Container | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private toastTimer?: Phaser.Time.TimerEvent;

  constructor() { super("OverworldScene"); }

  create() {
    this.save = loadSave();
    this.world = new WorldMap(this, getMap(this.save.mapId));
    this.world.build(this.save.defeated);

    const start = this.validStart(this.save.position);
    this.player = new PlayerController(this, this.world, start);
    this.player.onStep = (t) => this.onStep(t);
    this.dialog = new DialogBox(this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.pixelWidth, this.world.pixelHeight);
    cam.startFollow(this.player.sprite, true, 1, 1);
    cam.setRoundPixels(true);

    const kb = this.input.keyboard!;
    for (const k of ["ENTER", "SPACE", "Z"]) kb.on(`keydown-${k}`, () => this.onConfirm());
    kb.on("keydown-ESC", () => {
      if (this.battle) this.showToast("Battle: 1 Attack · 2 Capture · 3 Potion · 4 Run");
      else if (!this.dialog.isOpen) this.openDialog([this.objectiveText()]);
    });
    kb.addCapture("SPACE,UP,DOWN,LEFT,RIGHT");

    window.addEventListener("game:start", this.onStart);
    const cleanup = () => window.removeEventListener("game:start", this.onStart);
    this.events.once("shutdown", cleanup);
    this.events.once("destroy", cleanup);
    if ((window as unknown as { __ppaStarted?: boolean }).__ppaStarted) this.onStart();
  }

  update(time: number) {
    this.player.locked = !this.started || !!this.battle || this.dialog.isOpen;
    this.player.update(time);
  }

  /* ---------------------------------------------------------------- */
  /* Overworld                                                         */
  /* ---------------------------------------------------------------- */

  private onStart = () => {
    if (this.started) return;
    this.started = true;
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.openDialog(this.save.steps === 0 ? this.world.def.intro : [`${this.world.def.name}`, this.objectiveText()]);
  };

  private validStart(p: Point | null): Point {
    const spawn = this.world.def.spawn;
    if (!p) return spawn;
    const inside = p.x > 0 && p.y > 0 && p.x < this.world.width - 1 && p.y < this.world.height - 1;
    return inside && !this.world.isBlocked(p.x, p.y) ? p : spawn;
  }

  private objectiveText() {
    const trainers = ["trainer1", "trainer2", "trainer3"].filter((id) => this.save.defeated.includes(id)).length;
    if (this.save.badge) return "Forest Badge ✓ — đi theo đường phía đông để sang khu vực mới.";
    if (trainers < 3) return `Mục tiêu: đánh bại Trainer (${trainers}/3), rồi thách đấu Forest Guardian.`;
    return "Mục tiêu: thách đấu Forest Guardian ở cổng phía đông!";
  }

  private onConfirm() {
    if (!this.started) return;
    if (this.dialog.advance()) return;
    if (this.battle || this.player.isMoving) return;
    this.interact();
  }

  private onStep(t: Point) {
    this.save.steps++;
    this.save.position = { ...t };
    this.persist();

    const exit = this.world.exitAt(t.x, t.y);
    if (exit) {
      // Exits are trigger tiles, never a resting place: save the return tile.
      this.save.position = { ...exit.returnTo };
      this.persist();
      if (exit.requiresBadge && !this.save.badge) {
        this.openDialog(exit.lockedText, () => this.player.teleport(exit.returnTo, "left"));
      } else {
        if (!this.save.unlockedAreas.includes(exit.to)) this.save.unlockedAreas.push(exit.to);
        this.persist();
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.player.teleport(exit.returnTo, "left");
          this.cameras.main.fadeIn(250, 0, 0, 0);
          this.openDialog([`Đã mở khóa ${exit.toName}!`, `Bản đồ ${exit.toName} sẽ có trong bản cập nhật tiếp theo.`]);
        });
      }
      return;
    }

    if (this.world.isEncounterTile(t.x, t.y)) {
      const foe = this.encounters.rollStep(this.world.def.encounters);
      if (foe) this.flashThen(() => this.openBattle({ foe, queue: [], wild: true, boss: false }));
    }
  }

  private interact() {
    const f = this.player.facingTile();
    const npc = this.world.npcAt(f.x, f.y);
    if (npc) { this.talk(npc); return; }
    const sign = this.world.signAt(f.x, f.y);
    if (sign) { this.openDialog(sign.text); return; }
    const door = this.world.doorAt(f.x, f.y);
    if (door) { this.openDialog(door.doorText); return; }
  }

  private talk(n: NpcRuntime) {
    const def = n.def;
    this.world.faceNpc(n, opposite[this.player.facing]);
    const done = this.save.defeated.includes(def.id);

    if (def.role === "healer") {
      this.openDialog(def.dialog, () => { this.healParty(); this.persist(); });
      return;
    }
    if (def.role === "guide") { this.openDialog(def.dialog); return; }
    if (done) { this.openDialog(def.defeatedDialog ?? ["…"]); return; }
    const missing = (def.requires ?? []).filter((id) => !this.save.defeated.includes(id));
    if (missing.length) { this.openDialog(def.lockedDialog ?? ["Hãy quay lại sau."]); return; }
    if (!this.save.party.some((p) => p.hp > 0)) { this.openDialog(["Pokémon của bạn đã kiệt sức! Hãy gặp Nurse Maple."]); return; }

    const team = def.team ?? [];
    const [first, ...rest] = team;
    if (!first) return;
    this.openDialog(def.dialog, () => this.flashThen(() =>
      this.openBattle({ foe: makeCreature(first.speciesId, first.level), queue: rest, trainer: def, boss: def.role === "boss", wild: false })));
  }

  private openDialog(pages: string[], onDone?: () => void) { this.dialog.open(pages, onDone); }

  private flashThen(fn: () => void) {
    this.player.locked = true;
    this.cameras.main.flash(250, 255, 255, 255);
    this.time.delayedCall(260, fn);
  }

  private healParty() { this.save.party.forEach((p) => (p.hp = this.maxHp(p))); }

  /* ---------------------------------------------------------------- */
  /* Battle (kept as-is functionally; to be moved to BattleScene next) */
  /* ---------------------------------------------------------------- */

  private openBattle(b: Battle) {
    this.battle = b;
    this.battleLayer?.destroy(true);
    this.battleLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.renderBattle();
    const kb = this.input.keyboard!;
    kb.on("keydown-ONE", this.action1); kb.on("keydown-TWO", this.action2);
    kb.on("keydown-THREE", this.action3); kb.on("keydown-FOUR", this.action4);
  }

  private renderBattle() {
    const b = this.battle, L = this.battleLayer;
    if (!b || !L) return;
    L.removeAll(true);
    const t = (x: number, y: number, s: string, size = 14, color = "#ffffff") =>
      L.add(this.add.text(x, y, s, { fontFamily: "monospace", fontSize: `${size}px`, color }).setResolution(2));
    const bg = this.add.rectangle(320, 200, 640, 400, 0x14242c, 0.97).setInteractive();
    L.add(bg);
    t(24, 50, b.trainer ? `${b.trainer.name} challenges you!` : "A wild Pokémon appeared!", 16);
    const fs = getSpecies(b.foe.speciesId);
    L.add(this.add.ellipse(455, 155, 135, 40, 0x496b53, 0.8));
    L.add(this.add.circle(455, 115, 38, fs.color).setStrokeStyle(4, 0x243b35));
    t(355, 175, `${fs.name}  Lv.${b.foe.level}`, 16);
    t(355, 197, `HP ${Math.max(0, b.foe.hp)}/${this.maxHp(b.foe)}`, 13, "#bce6a5");
    const a = this.active(), ps = getSpecies(a.speciesId);
    L.add(this.add.ellipse(160, 265, 145, 40, 0x496b53, 0.8));
    L.add(this.add.circle(160, 222, 42, ps.color).setStrokeStyle(4, 0x243b35));
    t(25, 285, `${ps.name}  Lv.${a.level}`, 16);
    t(25, 307, `HP ${a.hp}/${this.maxHp(a)}   Balls ${this.save.balls}  Potions ${this.save.potions}`, 13, "#bce6a5");
    t(22, 332, "1 ATTACK    2 CAPTURE    3 POTION    4 RUN", 13, "#f5e5bd");
  }

  private active() { return this.save.party.find((p) => p.hp > 0) ?? this.save.party[0]; }
  private maxHp(c: Creature) { return getSpecies(c.speciesId).maxHp + c.level * 2; }
  private action1 = () => this.attack();
  private action2 = () => this.capture();
  private action3 = () => this.usePotion();
  private action4 = () => this.run();

  private attack() {
    if (!this.battle) return;
    const b = this.battle, a = this.active(), s = getSpecies(a.speciesId);
    b.foe.hp -= Math.max(3, s.attack + a.level + Math.floor(Math.random() * 4));
    if (b.foe.hp <= 0) { this.foeFainted(); return; }
    this.enemyTurn();
  }

  private capture() {
    if (!this.battle) return;
    if (!this.battle.wild) { this.showToast("Không thể bắt Pokémon của Trainer!"); return; }
    if (this.save.balls <= 0) { this.showToast("Bạn đã hết Poké Ball!"); return; }
    this.save.balls--;
    const b = this.battle, foe = getSpecies(b.foe.speciesId);
    const chance = clamp(foe.catchRate + (1 - b.foe.hp / this.maxHp(b.foe)) * 0.45, 0.08, 0.95);
    if (Math.random() < chance) {
      if (this.save.party.length < 6) { this.save.party.push(b.foe); this.showToast(`Bắt được ${foe.name}! Pokémon gia nhập đội.`); }
      else { this.save.box.push(b.foe); this.showToast(`Bắt được ${foe.name}! Đội đầy, gửi vào PC Box.`); }
      this.endBattle();
    } else {
      this.showToast("Pokémon thoát khỏi Poké Ball!");
      this.enemyTurn();
    }
    this.persist();
  }

  private usePotion() {
    if (!this.battle) return;
    if (this.save.potions <= 0) { this.showToast("Hết Potion!"); return; }
    const a = this.active();
    if (a.hp >= this.maxHp(a)) { this.showToast("Pokémon đang đầy HP."); return; }
    this.save.potions--;
    a.hp = clamp(a.hp + 20, 0, this.maxHp(a));
    this.enemyTurn();
  }

  private run() {
    if (!this.battle?.wild) { this.showToast("Không thể chạy khỏi trận Trainer!"); return; }
    this.endBattle();
    this.showToast("Bạn đã rút lui an toàn.");
  }

  private enemyTurn() {
    if (!this.battle) return;
    const a = this.active(), f = getSpecies(this.battle.foe.speciesId);
    a.hp = Math.max(0, a.hp - Math.max(2, f.attack + this.battle.foe.level + Math.floor(Math.random() * 3)));
    if (!this.save.party.some((p) => p.hp > 0)) { this.blackout(); return; }
    if (a.hp === 0) this.showToast(`${getSpecies(a.speciesId).name} đã kiệt sức! ${getSpecies(this.active().speciesId).name} ra trận.`);
    this.renderBattle();
    this.persist();
  }

  private blackout() {
    this.endBattle();
    this.healParty();
    this.player.teleport(this.world.def.healSpot, "down");
    this.save.position = { ...this.world.def.healSpot };
    this.persist();
    this.openDialog(["Cả đội đã kiệt sức…", "Nurse Maple đã hồi phục Pokémon và đưa bạn về Pokémon Center."]);
  }

  private foeFainted() {
    if (!this.battle) return;
    const b = this.battle, a = this.active(), foe = getSpecies(b.foe.speciesId);
    a.xp += foe.xp;
    let msg = `${foe.name} bị hạ! +${foe.xp} EXP.`;
    while (a.xp >= a.level * 20) { a.xp -= a.level * 20; a.level++; a.hp = this.maxHp(a); msg += ` ${getSpecies(a.speciesId).name} lên Lv.${a.level}!`; }
    const next = b.queue.shift();
    if (next) {
      b.foe = makeCreature(next.speciesId, next.level);
      this.showToast(`${msg} ${b.trainer?.name} gửi ra ${getSpecies(next.speciesId).name}!`);
      this.renderBattle();
      this.persist();
      return;
    }
    this.showToast(msg);
    this.endBattle();
    if (b.trainer) this.trainerDefeated(b.trainer, b.boss);
    this.persist();
  }

  private trainerDefeated(def: NpcDef, boss: boolean) {
    if (!this.save.defeated.includes(def.id)) this.save.defeated.push(def.id);
    const pages = [...(def.defeatedDialog ?? [])];
    if (boss) { this.save.badge = true; pages.unshift("Bạn đã nhận được FOREST BADGE!"); }
    this.persist();
    this.openDialog(pages, () => {
      const n = this.world.npcs.find((x) => x.def.id === def.id);
      if (n && def.moveToWhenDefeated) this.world.moveNpc(n, def.moveToWhenDefeated);
    });
  }

  private endBattle() {
    const kb = this.input.keyboard!;
    kb.off("keydown-ONE", this.action1); kb.off("keydown-TWO", this.action2);
    kb.off("keydown-THREE", this.action3); kb.off("keydown-FOUR", this.action4);
    this.battleLayer?.destroy(true);
    this.battleLayer = null;
    this.battle = null;
  }

  private persist() { saveGame(this.save); }

  private showToast(message: string) {
    this.toastText?.destroy();
    this.toastText = this.add.text(320, 62, message, {
      fontFamily: "monospace", fontSize: "12px", color: "#fff", backgroundColor: "#172c22",
      padding: { x: 10, y: 8 }, align: "center", wordWrap: { width: 570 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1500).setResolution(2);
    this.toastTimer?.remove(false);
    this.toastTimer = this.time.delayedCall(3000, () => this.toastText?.destroy());
  }
}
