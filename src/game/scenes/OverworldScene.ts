import Phaser from "phaser";
import { getMap } from "../data/maps";
import { session } from "../core/GameSession";
import { createPokemon } from "../core/pokemon";
import { PlayerController } from "../entities/PlayerController";
import { EncounterSystem } from "../systems/EncounterSystem";
import { DialogBox, showLocationBanner } from "../ui/DialogBox";
import { WorldMap, type NpcRuntime } from "../world/WorldMap";
import type { Direction, NpcDef, Point } from "../world/types";
import type { BattleSetup } from "../battle/BattleEngine";
import type { BattleResult, BattleSceneData } from "./BattleScene";
import { isUiOpen, useGameStore } from "../../state/gameStore";

const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

export class OverworldScene extends Phaser.Scene {
  private world!: WorldMap;
  private player!: PlayerController;
  private dialog!: DialogBox;
  private encounters = new EncounterSystem();
  private started = false;
  private inBattle = false;
  private lastTile: Point = { x: 0, y: 0 };
  private awaitingStarter = false;

  constructor() { super("OverworldScene"); }

  private get save() { return session.data; }

  create() {
    this.world = new WorldMap(this, getMap(this.save.mapId));
    this.world.build(this.save.defeated);

    const start = this.validStart(this.save.position);
    this.lastTile = { ...start };
    this.player = new PlayerController(this, this.world, start);
    this.player.onStep = (t) => this.onStep(t);
    this.dialog = new DialogBox(this, () => this.onConfirm());

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.pixelWidth, this.world.pixelHeight);
    cam.startFollow(this.player.sprite, true, 1, 1);
    cam.setRoundPixels(true);

    const kb = this.input.keyboard!;
    for (const k of ["ENTER", "SPACE", "Z"]) kb.on(`keydown-${k}`, () => this.onConfirm());
    kb.on("keydown-ESC", () => this.openMenu());
    kb.on("keydown-TAB", () => { if (this.canAct()) useGameStore.getState().open("party"); });
    kb.addCapture("SPACE,UP,DOWN,LEFT,RIGHT,TAB");

    const offSession = session.on(() => this.onSessionChange());
    window.addEventListener("game:start", this.onStart);
    const cleanup = () => { window.removeEventListener("game:start", this.onStart); offSession(); };
    this.events.once("shutdown", cleanup);
    this.events.once("destroy", cleanup);
    if ((window as unknown as { __ppaStarted?: boolean }).__ppaStarted) this.onStart();
  }

  update(time: number) {
    this.player.locked = !this.started || this.inBattle || this.dialog.isOpen || isUiOpen();
    this.player.update(time);
  }

  /* ---------------------------------------------------------------- */
  /* Overworld                                                         */
  /* ---------------------------------------------------------------- */

  private onStart = () => {
    if (this.started) return;
    this.started = true;
    this.cameras.main.fadeIn(400, 0, 0, 0);
    showLocationBanner(this, this.world.def.name);
    this.openDialog(!this.save.starterChosen ? this.world.def.intro : [this.world.def.name, this.objectiveText()]);
  };

  private canAct() { return this.started && !this.inBattle && !this.dialog.isOpen && !isUiOpen() && !this.player.isMoving; }

  private openMenu() {
    if (this.dialog.isOpen || this.inBattle || !this.started || isUiOpen()) return;
    useGameStore.getState().open("menu");
  }

  private onSessionChange() {
    if (this.awaitingStarter && this.save.starterChosen) {
      this.awaitingStarter = false;
      this.time.delayedCall(150, () => (this.speaker = "Ranger Oak", this.openDialog([
        "Ranger Oak: Lựa chọn tuyệt vời! Hãy chăm sóc nó thật tốt nhé.",
        "Ta tặng thêm 5 Poké Ball. Bấm ESC để mở menu xem đội hình và túi đồ.",
      ], () => { session.addItem("poke-ball", 5); session.changed(); })));
    }
  }

  private validStart(p: Point | null): Point {
    const spawn = this.world.def.spawn;
    if (!p) return spawn;
    const inside = p.x > 0 && p.y > 0 && p.x < this.world.width - 1 && p.y < this.world.height - 1;
    return inside && !this.world.isBlocked(p.x, p.y) ? p : spawn;
  }

  private objectiveText() {
    if (!this.save.starterChosen) return "Mục tiêu: gặp Ranger Oak để nhận Pokémon đầu tiên.";
    const trainers = ["trainer1", "trainer2", "trainer3"].filter((id) => this.save.defeated.includes(id)).length;
    if (this.save.badges.includes("forest")) return "Forest Badge ✓ — đi theo đường phía đông để sang khu vực mới.";
    if (trainers < 3) return `Mục tiêu: đánh bại Trainer (${trainers}/3), rồi thách đấu Forest Guardian.`;
    return "Mục tiêu: thách đấu Forest Guardian ở cổng phía đông!";
  }

  private onConfirm() {
    if (!this.started || this.inBattle || isUiOpen()) return;
    if (this.dialog.advance()) return;
    if (this.player.isMoving) return;
    this.interact();
  }

  private onStep(t: Point) {
    this.save.steps++;
    this.save.position = { ...t };

    const exit = this.world.exitAt(t.x, t.y);
    if (exit) {
      this.save.position = { ...exit.returnTo };
      session.save();
      if (exit.requiresBadge && !this.save.badges.includes("forest")) {
        this.openDialog(exit.lockedText, () => this.player.teleport(exit.returnTo, "left"));
      } else {
        if (!this.save.unlockedAreas.includes(exit.to)) this.save.unlockedAreas.push(exit.to);
        session.changed();
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.player.teleport(exit.returnTo, "left");
          this.cameras.main.fadeIn(250, 0, 0, 0);
          this.openDialog([`Đã mở khóa ${exit.toName}!`, `Bản đồ ${exit.toName} sẽ có trong bản cập nhật tiếp theo.`]);
        });
      }
      this.lastTile = { ...exit.returnTo };
      return;
    }

    if (this.world.isEncounterTile(t.x, t.y)) {
      if (!this.save.starterChosen) {
        const back = { ...this.lastTile };
        this.save.position = { ...back };
        this.speaker = "Ranger Oak";
        this.openDialog(["Ranger Oak: Khoan đã! Cỏ cao rất nguy hiểm khi chưa có Pokémon!", "Hãy đến gặp ta để nhận Pokémon đầu tiên."],
          () => this.player.teleport(back, opposite[this.player.facing]));
        return;
      }
      if (session.hasUsablePokemon()) {
        const foe = this.encounters.rollStep(this.world.def.encounters);
        if (foe) { this.lastTile = { ...t }; this.startBattle({ kind: "wild", foeParty: [foe] }); return; }
      }
    }
    this.lastTile = { ...t };
    if (this.save.steps % 8 === 0) session.save();
  }

  private interact() {
    this.speaker = undefined;
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
    this.speaker = def.name;
    this.world.faceNpc(n, opposite[this.player.facing]);
    const done = this.save.defeated.includes(def.id);

    if (def.role === "healer") {
      if (!this.save.party.length) { this.openDialog(["Chào bạn! Khi nào có Pokémon hãy ghé lại nhé."]); return; }
      this.openDialog(def.dialog, () => { session.healAll(); session.changed(); });
      return;
    }
    if (def.role === "mart") { this.openDialog(def.dialog, () => useGameStore.getState().open("mart")); return; }
    if (def.role === "guide") {
      if (def.givesStarter && !this.save.starterChosen) {
        this.openDialog([
          "Ranger Oak: Chào cậu! Ra ngoài mà không có Pokémon thì nguy hiểm lắm.",
          "Ta có 3 Pokémon ở đây. Hãy chọn một bạn đồng hành!",
        ], () => { this.awaitingStarter = true; useGameStore.getState().open("starter"); });
        return;
      }
      this.openDialog(def.dialog);
      return;
    }
    if (done) { this.openDialog(def.defeatedDialog ?? ["…"]); return; }
    if (!this.save.starterChosen) { this.openDialog(["Bạn chưa có Pokémon! Hãy gặp Ranger Oak trước."]); return; }
    const missing = (def.requires ?? []).filter((id) => !this.save.defeated.includes(id));
    if (missing.length) { this.openDialog(def.lockedDialog ?? ["Hãy quay lại sau."]); return; }
    if (!session.hasUsablePokemon()) { this.openDialog(["Pokémon của bạn đã kiệt sức! Hãy gặp Nurse Maple."]); return; }

    const team = (def.team ?? []).map((t) => createPokemon(t.speciesId, t.level));
    if (!team.length) return;
    this.openDialog(def.dialog, () => this.startBattle({ kind: "trainer", foeParty: team, trainerName: def.name, prize: def.prize, trainerLook: def.look }, def));
  }

  private speaker: string | undefined;
  /** Opens the text box; inside talk() the NPC's name is shown as the speaker. */
  private openDialog(pages: string[], onDone?: () => void) {
    const speaker = this.speaker;
    this.speaker = undefined;
    this.dialog.open(pages.map((p) => (speaker ? p.replace(new RegExp(`^${speaker}: `), "") : p)), onDone, speaker);
  }

  /* ---------------------------------------------------------------- */
  /* Battles                                                           */
  /* ---------------------------------------------------------------- */

  private startBattle(partial: Pick<BattleSetup, "kind" | "foeParty" | "trainerName" | "prize" | "trainerLook">, trainer?: NpcDef) {
    this.inBattle = true;
    const setup: BattleSetup = {
      ...partial,
      playerParty: this.save.party,
      bag: { count: (id) => session.count(id), take: (id) => session.takeItem(id) },
      onCaught: (mon) => session.addPokemon(mon),
      onSeen: (id) => session.markSeen(id),
      onEvolved: (id) => session.markCaught(id),
    };
    const data: BattleSceneData = { setup, onEnd: (r) => this.endBattle(r, trainer) };
    // Classic encounter transition: two flashes, then black bars sweep in from alternating sides.
    const cam = this.cameras.main;
    cam.flash(110, 255, 255, 255);
    this.time.delayedCall(160, () => cam.flash(110, 255, 255, 255));
    const bars = this.add.graphics().setScrollFactor(0).setDepth(5000);
    const t = { v: 0 }, n = 10, bh = this.scale.height / n, w = this.scale.width;
    this.time.delayedCall(320, () => this.tweens.add({
      targets: t, v: 1, duration: 520, ease: "Quad.easeIn",
      onUpdate: () => {
        bars.clear().fillStyle(0x000000, 1);
        for (let i = 0; i < n; i++) {
          const len = w * Math.min(1, t.v * 1.25 - (i % 3) * 0.08);
          if (len <= 0) continue;
          if (i % 2) bars.fillRect(w - len, i * bh, len, bh + 1); else bars.fillRect(0, i * bh, len, bh + 1);
        }
      },
      onComplete: () => {
        this.scene.launch("BattleScene", data);
        this.scene.pause();
        this.time.delayedCall(0, () => bars.destroy());
        this.battleBars = bars;
      },
    }));
  }

  private battleBars?: Phaser.GameObjects.Graphics;

  private endBattle(r: BattleResult, trainer?: NpcDef) {
    this.scene.resume();
    this.battleBars?.destroy();
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.inBattle = false;

    if (r.outcome === "lose") {
      const lost = Math.floor(this.save.money / 2);
      this.save.money -= lost;
      session.healAll();
      this.player.teleport(this.world.def.healSpot, "down");
      this.save.position = { ...this.world.def.healSpot };
      this.lastTile = { ...this.world.def.healSpot };
      session.changed();
      this.openDialog(["Bạn đã bất tỉnh…", `Bạn đánh rơi ₽${lost} trong lúc hoảng loạn.`, "Nurse Maple đã hồi phục Pokémon và đưa bạn về Pokémon Center."]);
      return;
    }
    if (r.outcome === "win" && trainer) {
      if (!this.save.defeated.includes(trainer.id)) this.save.defeated.push(trainer.id);
      this.save.money += r.prizeMoney;
      const pages = [...(trainer.defeatedDialog ?? [])];
      if (trainer.badge && !this.save.badges.includes(trainer.badge)) {
        this.save.badges.push(trainer.badge);
        pages.unshift("Bạn đã nhận được FOREST BADGE!");
      }
      session.changed();
      this.openDialog(pages, () => {
        const n = this.world.npcs.find((x) => x.def.id === trainer.id);
        if (n && trainer.moveToWhenDefeated) this.world.moveNpc(n, trainer.moveToWhenDefeated);
      });
      return;
    }
    session.changed();
  }
}
