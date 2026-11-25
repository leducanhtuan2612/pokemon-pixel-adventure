import Phaser from "phaser";
import { BattleEngine, viewOf, type BattleEvent, type BattleSetup, type MonView, type Outcome, type PlayerAction, type Side } from "../battle/BattleEngine";
import { hasBack, spriteKey } from "../battle/sprites";
import { ITEMS, getItem } from "../data/items";
import { getMove } from "../data/moves";
import { getSpecies } from "../data/species";
import { TYPE_COLORS, TYPE_VI, categoryOf } from "../data/types";
import { STATUS_COLOR, STATUS_LABEL, displayName, evolve, maxHp, type PokemonInstance } from "../core/pokemon";

export interface BattleResult { outcome: Outcome; prizeMoney: number }
export interface BattleSceneData { setup: BattleSetup; onEnd: (r: BattleResult) => void }

type Key = "up" | "down" | "left" | "right" | "ok" | "back";

const W = 640, H = 400, PANEL_Y = 300;
const FONT = "monospace";
const C = { ink: "#303038", inkShadow: "#d0d0c8", white: "#f8f8f8", frame: 0x384858, box: 0xf8f8f0, accent: 0xe04848 };
const txt = (s: Phaser.Scene, x: number, y: number, str: string, size = 15, color = C.ink) =>
  s.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, shadow: color === C.ink ? { offsetX: 1, offsetY: 1, color: C.inkShadow, fill: true } : undefined }).setResolution(2);

const hpColor = (f: number) => (f > 0.5 ? 0x58d080 : f > 0.2 ? 0xf8c030 : 0xf05858);
const BALL_COLORS: Record<string, [number, number]> = { "poke-ball": [0xe04040, 0xf8f8f8], "great-ball": [0x3878e0, 0xe04040], "ultra-ball": [0x303030, 0xf8d030] };

interface InfoBox {
  root: Phaser.GameObjects.Container; name: Phaser.GameObjects.Text; level: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Rectangle; barW: number; status: Phaser.GameObjects.Text;
  hpText?: Phaser.GameObjects.Text; exp?: Phaser.GameObjects.Rectangle; expW?: number; view?: MonView;
}

/**
 * FireRed-style battle UI. All rules live in BattleEngine; this scene only
 * collects player choices and plays back the engine's events.
 */
export class BattleScene extends Phaser.Scene {
  private engine!: BattleEngine;
  private data_!: BattleSceneData;
  private keyWaiter: ((k: Key) => void) | null = null;
  private msg!: Phaser.GameObjects.Text;
  private msgArrow!: Phaser.GameObjects.Text;
  private ui!: Phaser.GameObjects.Container;
  private foeSprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private foeBox!: InfoBox;
  private playerBox!: InfoBox;
  private lastAction = 0;
  private lastMove = 0;

  constructor() { super("BattleScene"); }

  init(data: BattleSceneData) { this.data_ = data; }

  create() {
    this.engine = new BattleEngine(this.data_.setup);
    this.drawBackground();
    this.foeSprite = this.add.image(480, 176, "__DEFAULT").setOrigin(0.5, 1).setVisible(false).setDepth(5);
    this.playerSprite = this.add.image(170, 298, "__DEFAULT").setOrigin(0.5, 1).setVisible(false).setDepth(5);
    this.foeBox = this.makeInfoBox(24, 26, false);
    this.playerBox = this.makeInfoBox(350, 196, true);
    this.drawMessageBox();
    this.ui = this.add.container(0, 0).setDepth(50);

    const kb = this.input.keyboard!;
    const map: Record<string, Key> = {
      UP: "up", W: "up", DOWN: "down", S: "down", LEFT: "left", A: "left", RIGHT: "right", D: "right",
      Z: "ok", ENTER: "ok", SPACE: "ok", X: "back", ESC: "back", ESCAPE: "back", BACKSPACE: "back",
    };
    kb.on("keydown", (e: KeyboardEvent) => {
      const k = map[e.key.length === 1 ? e.key.toUpperCase() : e.key.replace("Arrow", "").toUpperCase()] ?? map[e.code.replace("Key", "").toUpperCase()];
      if (!k || !this.keyWaiter) return;
      const fn = this.keyWaiter; this.keyWaiter = null; fn(k);
    });

    this.cameras.main.fadeIn(300, 255, 255, 255);
    void this.run();
  }

  /* ------------------------------------------------------------ */
  /* Flow                                                         */
  /* ------------------------------------------------------------ */

  private async run() {
    await this.play(this.engine.intro());
    while (this.engine.phase !== "over") {
      if (this.engine.phase === "forceSwitch") {
        const idx = await this.pickPokemon(true, "Chọn Pokémon tiếp theo.");
        if (idx !== null) await this.play(this.engine.forceSwitch(idx));
        continue;
      }
      const action = await this.chooseAction();
      if (action) await this.play(this.engine.act(action));
    }
    for (const evo of this.engine.pendingEvolutions()) await this.evolveSequence(evo.mon, evo.into);
    await this.wait(250);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    await this.wait(380);
    const result = { outcome: this.engine.outcome ?? "run", prizeMoney: this.engine.prizeMoney };
    this.scene.stop();
    this.data_.onEnd(result);
  }

  private async chooseAction(): Promise<PlayerAction | null> {
    for (;;) {
      const choice = await this.actionMenu();
      if (choice === 0) {
        const idx = await this.moveMenu();
        if (idx !== null) return { type: "move", index: idx };
      } else if (choice === 1) {
        const item = await this.bagMenu();
        if (item) return item;
      } else if (choice === 2) {
        const idx = await this.pickPokemon(false, "Chọn một Pokémon.");
        if (idx !== null) {
          if (this.data_.setup.playerParty[idx] === this.engine.playerMon) { await this.say(`${displayName(this.engine.playerMon)} đang chiến đấu rồi!`); continue; }
          return { type: "switch", index: idx };
        }
      } else if (choice === 3) {
        return { type: "run" };
      }
    }
  }

  /* ------------------------------------------------------------ */
  /* Event playback                                               */
  /* ------------------------------------------------------------ */

  private async play(events: BattleEvent[]) {
    for (const e of events) {
      switch (e.kind) {
        case "text": await this.say(e.text); break;
        case "sendOut": await this.sendOut(e.side, e.mon); break;
        case "recall": await this.tween({ targets: this.playerSprite, scale: 0, alpha: 0, duration: 250 }); break;
        case "move": await this.moveAnim(e.side, e.move.type, e.move.power > 0, categoryOf(e.move.type)); break;
        case "hit": await this.hitAnim(e.side, e.eff); break;
        case "hp": await this.animateHp(e.side === "player" ? this.playerBox : this.foeBox, e.hp, e.maxHp); break;
        case "status": this.setStatus(e.side === "player" ? this.playerBox : this.foeBox, e.status); break;
        case "stat": await this.statAnim(e.side, e.up); break;
        case "faint": await this.faintAnim(e.side); break;
        case "ball": await this.ballAnim(e.ball, e.shakes, e.caught); break;
        case "exp":
          if (this.playerBox.view?.uid === e.uid) await this.animateExp(e.from, e.to);
          break;
        case "levelUp":
          if (this.playerBox.view?.uid === e.uid) {
            this.playerBox.view = e.mon;
            this.playerBox.level.setText(`Lv${e.mon.level}`);
            this.drawHp(this.playerBox, e.mon.hp, e.mon.maxHp);
            this.tweens.add({ targets: this.playerSprite, y: this.playerSprite.y - 8, yoyo: true, duration: 120, repeat: 1 });
          }
          break;
        case "learn": await this.learnPrompt(e.uid, e.moveId); break;
        case "end": break;
      }
    }
  }

  private async say(text: string) {
    this.msg.setWordWrapWidth(590).setText("");
    this.msgArrow.setVisible(false);
    for (let i = 1; i <= text.length; i += 2) { this.msg.setText(text.slice(0, i)); await this.wait(12); }
    this.msg.setText(text);
    this.msgArrow.setVisible(true);
    await this.waitOk(1600);
    this.msgArrow.setVisible(false);
  }

  /** Waits for confirm, or auto-advances after `auto` ms so long turns keep flowing. */
  private waitOk(auto: number): Promise<void> {
    return new Promise((res) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (this.keyWaiter === handler) this.keyWaiter = null;
        res();
      };
      const handler = (k: Key) => { if (k === "ok" || k === "back") finish(); else this.keyWaiter = handler; };
      this.keyWaiter = handler;
      this.time.delayedCall(auto, finish);
    });
  }

  /* ------------------------------------------------------------ */
  /* Drawing                                                      */
  /* ------------------------------------------------------------ */

  private drawBackground() {
    const g = this.add.graphics();
    // Sky band → field, classic grass battle backdrop
    const bands = [0xe8f0d8, 0xe0ecd0, 0xd8e8c8, 0xd0e4c0];
    bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 30, W, 30));
    g.fillStyle(0xc8e0b0, 1).fillRect(0, 120, W, PANEL_Y - 120);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(i % 2 ? 0xb8d8a0 : 0xd8ecc0, 1).fillRect((i * 97) % W, 130 + ((i * 53) % 160), 18, 3);
    }
    // Platforms
    g.fillStyle(0x88b868, 1).fillEllipse(480, 172, 236, 56);
    g.fillStyle(0xa8d888, 1).fillEllipse(480, 168, 220, 46);
    g.fillStyle(0x88b868, 1).fillEllipse(170, 292, 290, 64);
    g.fillStyle(0xa8d888, 1).fillEllipse(170, 287, 272, 52);
  }

  private drawMessageBox() {
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(0x283848, 1).fillRect(0, PANEL_Y, W, H - PANEL_Y);
    g.fillStyle(0xd85848, 1).fillRoundedRect(6, PANEL_Y + 6, W - 12, H - PANEL_Y - 12, 6);
    g.fillStyle(C.box, 1).fillRoundedRect(12, PANEL_Y + 12, W - 24, H - PANEL_Y - 24, 4);
    this.msg = txt(this, 28, PANEL_Y + 24, "", 17).setDepth(41).setLineSpacing(8).setWordWrapWidth(590);
    this.msgArrow = txt(this, W - 44, H - 38, "▼", 14, "#e04848").setDepth(41).setVisible(false);
    this.tweens.add({ targets: this.msgArrow, y: H - 34, yoyo: true, repeat: -1, duration: 300 });
  }

  private makeInfoBox(x: number, y: number, player: boolean): InfoBox {
    const w = player ? 270 : 260, h = player ? 86 : 62;
    const root = this.add.container(x, y).setDepth(20).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(0x404850, 1).fillRoundedRect(0, 0, w, h, 8);
    g.fillStyle(0xf8f8e0, 1).fillRoundedRect(3, 3, w - 6, h - 6, 6);
    g.fillStyle(0x404850, 1).fillRoundedRect(70, 34, 172, 12, 4);
    root.add(g);
    const name = txt(this, 14, 8, "", 16);
    const level = txt(this, w - 64, 8, "", 15);
    const hpLabel = txt(this, 76, 33, "HP", 10, "#f8b030");
    const bar = this.add.rectangle(98, 36, 140, 8, 0x58d080).setOrigin(0, 0);
    const status = this.add.text(14, 32, "", { fontFamily: FONT, fontSize: "11px", color: "#ffffff", padding: { x: 4, y: 1 } }).setResolution(2).setVisible(false);
    root.add([name, level, hpLabel, bar, status]);
    const box: InfoBox = { root, name, level, bar, barW: 140, status };
    if (player) {
      box.hpText = txt(this, 150, 50, "", 15);
      g.fillStyle(0x404850, 1).fillRect(40, 74, 220, 6);
      box.exp = this.add.rectangle(42, 75, 0, 4, 0x58a8f0).setOrigin(0, 0);
      box.expW = 216;
      root.add([box.hpText, txt(this, 14, 69, "EXP", 9, "#4888c8"), box.exp]);
    }
    return box;
  }

  private setView(box: InfoBox, v: MonView) {
    box.view = { ...v };
    box.name.setText(v.name.toUpperCase());
    box.level.setText(`Lv${v.level}`);
    this.drawHp(box, v.hp, v.maxHp);
    this.setStatus(box, v.status);
    if (box.exp && box.expW) box.exp.width = box.expW * v.expFrac;
  }

  private drawHp(box: InfoBox, hp: number, max: number) {
    const f = Math.max(0, hp / max);
    box.bar.width = box.barW * f;
    box.bar.fillColor = hpColor(f);
    box.hpText?.setText(`${Math.ceil(hp).toString().padStart(3, " ")}/ ${max}`);
    if (box.view) { box.view.hp = hp; box.view.maxHp = max; }
  }

  private setStatus(box: InfoBox, s: MonView["status"]) {
    if (box.view) box.view.status = s;
    if (!s) { box.status.setVisible(false); return; }
    box.status.setText(STATUS_LABEL[s]).setBackgroundColor(STATUS_COLOR[s]).setVisible(true);
  }

  /* ------------------------------------------------------------ */
  /* Animations                                                   */
  /* ------------------------------------------------------------ */

  private async sendOut(side: Side, v: MonView) {
    const sprite = side === "player" ? this.playerSprite : this.foeSprite;
    const box = side === "player" ? this.playerBox : this.foeBox;
    const back = side === "player" && hasBack(this, v.speciesId);
    sprite.setTexture(spriteKey(v.speciesId, back ? "back" : "front"));
    sprite.setFlipX(side === "player" && !back);
    const scale = side === "player" ? 7 : 6;
    sprite.setVisible(true).setAlpha(1).setY(side === "player" ? 298 : 176).setScale(0).setTint(0xffffff);
    this.setView(box, v);
    if (side === "foe") {
      sprite.setScale(scale).setX(-80);
      await this.tween({ targets: sprite, x: 480, duration: 420, ease: "Quad.easeOut" });
    } else {
      sprite.setX(170);
      this.flashSprite(sprite, 0xffffff);
      await this.tween({ targets: sprite, scale, duration: 260, ease: "Back.easeOut" });
    }
    await this.tween({ targets: box.root, alpha: 1, duration: 200 });
  }

  private async moveAnim(side: Side, type: keyof typeof TYPE_COLORS, damaging: boolean, cat: "physical" | "special") {
    const user = side === "player" ? this.playerSprite : this.foeSprite;
    const target = side === "player" ? this.foeSprite : this.playerSprite;
    const color = Phaser.Display.Color.HexStringToColor(TYPE_COLORS[type]).color;
    const dir = side === "player" ? 1 : -1;
    if (!damaging) { this.flashSprite(user, color); await this.wait(350); return; }
    if (cat === "physical") {
      await this.tween({ targets: user, x: user.x + 28 * dir, y: user.y - 10 * dir, duration: 110, yoyo: true });
    } else {
      // Energy orbs travel from the user to the target.
      const orbs = Array.from({ length: 5 }, (_, i) => this.add.circle(user.x, user.y - 40, 7 - i, color).setDepth(30));
      await Promise.all(orbs.map((o, i) => this.tween({ targets: o, x: target.x, y: target.y - 40, duration: 300, delay: i * 40 })));
      orbs.forEach((o) => o.destroy());
    }
    // Impact burst
    const parts = Array.from({ length: 8 }, (_, i) => {
      const p = this.add.rectangle(target.x, target.y - 45, 6, 6, color).setDepth(30);
      const a = (i / 8) * Math.PI * 2;
      this.tweens.add({ targets: p, x: target.x + Math.cos(a) * 42, y: target.y - 45 + Math.sin(a) * 42, alpha: 0, duration: 320, onComplete: () => p.destroy() });
      return p;
    });
    void parts;
  }

  private async hitAnim(side: Side, eff: number) {
    const s = side === "player" ? this.playerSprite : this.foeSprite;
    if (eff > 1) this.cameras.main.shake(180, 0.008);
    for (let i = 0; i < 3; i++) { s.setAlpha(0.15); await this.wait(60); s.setAlpha(1); await this.wait(60); }
  }

  private async animateHp(box: InfoBox, hp: number, max: number) {
    const from = box.view?.hp ?? hp;
    const o = { v: from };
    await this.tween({ targets: o, v: hp, duration: Math.min(700, 120 + Math.abs(from - hp) * 18), onUpdate: () => this.drawHp(box, o.v, max) });
    this.drawHp(box, hp, max);
  }

  private async animateExp(from: number, to: number) {
    const bar = this.playerBox.exp!, w = this.playerBox.expW!;
    bar.width = w * from;
    await this.tween({ targets: bar, width: w * to, duration: 500 + 600 * Math.abs(to - from) });
  }

  private async statAnim(side: Side, up: boolean) {
    const s = side === "player" ? this.playerSprite : this.foeSprite;
    const arrows = Array.from({ length: 4 }, (_, i) =>
      txt(this, s.x - 36 + i * 22, s.y - (up ? 30 : 100), up ? "▲" : "▼", 18, up ? "#4878f0" : "#e05050").setDepth(30));
    await Promise.all(arrows.map((a, i) => this.tween({ targets: a, y: a.y + (up ? -60 : 60), alpha: 0, duration: 520, delay: i * 50 })));
    arrows.forEach((a) => a.destroy());
  }

  private async faintAnim(side: Side) {
    const s = side === "player" ? this.playerSprite : this.foeSprite;
    const box = side === "player" ? this.playerBox : this.foeBox;
    await this.tween({ targets: s, y: s.y + 70, alpha: 0, duration: 380, ease: "Quad.easeIn" });
    s.setVisible(false);
    await this.tween({ targets: box.root, alpha: 0, duration: 150 });
  }

  private async ballAnim(ballId: string, shakes: number, caught: boolean) {
    const [top, bottom] = BALL_COLORS[ballId] ?? BALL_COLORS["poke-ball"];
    const ball = this.add.container(120, 260).setDepth(35);
    const g = this.add.graphics();
    g.fillStyle(0x202020, 1).fillCircle(0, 0, 10);
    g.fillStyle(bottom, 1).fillCircle(0, 0, 8);
    g.fillStyle(top, 1); g.beginPath(); g.slice(0, 0, 8, Math.PI, 0, false); g.fillPath();
    g.fillStyle(0x202020, 1).fillRect(-8, -1, 16, 2);
    g.fillStyle(0xf8f8f8, 1).fillCircle(0, 0, 3);
    ball.add(g);
    const tx = this.foeSprite.x, ty = this.foeSprite.y - 50;
    const arc = { t: 0 };
    await this.tween({ targets: arc, t: 1, duration: 520, onUpdate: () => {
      ball.x = Phaser.Math.Linear(120, tx, arc.t);
      ball.y = Phaser.Math.Linear(260, ty, arc.t) - Math.sin(arc.t * Math.PI) * 120;
      ball.rotation = arc.t * 10;
    } });
    ball.rotation = 0;
    this.flashSprite(this.foeSprite, 0xffffff);
    await this.tween({ targets: this.foeSprite, scale: 0, duration: 220 });
    await this.tween({ targets: ball, y: this.foeSprite.y - 10, duration: 260, ease: "Bounce.easeOut" });
    for (let i = 0; i < shakes; i++) {
      await this.wait(260);
      await this.tween({ targets: ball, angle: 22, duration: 90, yoyo: true });
      await this.tween({ targets: ball, angle: -22, duration: 90, yoyo: true });
    }
    await this.wait(300);
    if (caught) {
      for (let i = 0; i < 3; i++) {
        const star = txt(this, ball.x, ball.y - 10, "✦", 16, "#f8d030").setDepth(36).setOrigin(0.5);
        this.tweens.add({ targets: star, x: ball.x + (i - 1) * 30, y: ball.y - 40, alpha: 0, duration: 600, onComplete: () => star.destroy() });
      }
      await this.tween({ targets: ball, alpha: 0.6, duration: 300 });
      this.time.delayedCall(1500, () => ball.destroy());
    } else {
      ball.destroy();
      this.flashSprite(this.foeSprite, 0xffffff);
      await this.tween({ targets: this.foeSprite, scale: 6, duration: 220, ease: "Back.easeOut" });
    }
  }

  private flashSprite(s: Phaser.GameObjects.Image, color: number) {
    s.setTintFill(color);
    this.time.delayedCall(90, () => s.clearTint());
    this.time.delayedCall(180, () => s.setTintFill(color));
    this.time.delayedCall(270, () => s.clearTint());
  }

  /* ------------------------------------------------------------ */
  /* Menus                                                        */
  /* ------------------------------------------------------------ */

  private panel(x: number, y: number, w: number, h: number) {
    const g = this.add.graphics();
    g.fillStyle(0x404850, 1).fillRoundedRect(x, y, w, h, 8);
    g.fillStyle(C.box, 1).fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);
    this.ui.add(g);
    return g;
  }

  private clearUi() { this.ui.removeAll(true); }

  /** Generic grid cursor. Returns index or null on back. */
  private async grid(items: Phaser.GameObjects.Text[], cols: number, start: number, onMove?: (i: number) => void, allowBack = true): Promise<number | null> {
    const cursor = txt(this, 0, 0, "▶", 14, "#303038");
    this.ui.add(cursor);
    let i = Math.min(start, items.length - 1);
    const place = () => { cursor.setPosition(items[i].x - 18, items[i].y + 1); onMove?.(i); };
    place();
    for (;;) {
      const k = await this.nextKey();
      const rows = Math.ceil(items.length / cols);
      const r = Math.floor(i / cols), c = i % cols;
      if (k === "ok") return i;
      if (k === "back" && allowBack) return null;
      let ni = i;
      if (k === "left" && c > 0) ni = i - 1;
      if (k === "right" && c < cols - 1 && i + 1 < items.length) ni = i + 1;
      if (k === "up" && r > 0) ni = i - cols;
      if (k === "down" && r < rows - 1 && i + cols < items.length) ni = i + cols;
      if (ni !== i) { i = ni; place(); }
    }
  }

  private async actionMenu(): Promise<number> {
    this.clearUi();
    this.msg.setWordWrapWidth(330).setText(`${displayName(this.engine.playerMon)} sẽ làm gì?`);
    this.panel(370, PANEL_Y, 270, 100);
    const labels = ["ĐÁNH", "TÚI", "POKéMON", "CHẠY"];
    const items = labels.map((l, i) => txt(this, 410 + (i % 2) * 118, PANEL_Y + 24 + Math.floor(i / 2) * 36, l, 16));
    this.ui.add(items);
    for (;;) {
      const r = await this.grid(items, 2, this.lastAction, undefined, false);
      if (r !== null) { this.lastAction = r; this.clearUi(); return r; }
    }
  }

  private async moveMenu(): Promise<number | null> {
    this.clearUi();
    const mon = this.engine.playerMon;
    this.panel(0, PANEL_Y, 440, 100);
    this.panel(436, PANEL_Y, 204, 100);
    const items = [0, 1, 2, 3].map((i) => {
      const m = mon.moves[i];
      return txt(this, 40 + (i % 2) * 200, PANEL_Y + 24 + Math.floor(i / 2) * 36, m ? getMove(m.id).name.toUpperCase() : "-", 15);
    }).slice(0, Math.max(1, mon.moves.length));
    this.ui.add(items);
    const pp = txt(this, 456, PANEL_Y + 16, "", 15);
    const type = this.add.text(456, PANEL_Y + 42, "", { fontFamily: FONT, fontSize: "12px", color: "#fff", padding: { x: 6, y: 2 } }).setResolution(2);
    const power = txt(this, 456, PANEL_Y + 70, "", 12, "#606068");
    this.ui.add([pp, type, power]);
    const r = await this.grid(items, 2, Math.min(this.lastMove, items.length - 1), (i) => {
      const m = mon.moves[i];
      if (!m) return;
      const d = getMove(m.id);
      pp.setText(`PP ${m.pp}/${m.maxPp}`).setColor(m.pp === 0 ? "#e04848" : m.pp <= m.maxPp / 4 ? "#e08830" : C.ink);
      type.setText(TYPE_VI[d.type].toUpperCase()).setBackgroundColor(TYPE_COLORS[d.type]);
      power.setText(d.power ? `Sức mạnh ${d.power} · ${d.accuracy ?? "—"}%` : "Chiêu trạng thái");
    });
    this.clearUi();
    if (r === null) return null;
    this.lastMove = r;
    return r;
  }

  private async bagMenu(): Promise<PlayerAction | null> {
    const bag = this.data_.setup.bag;
    const owned = Object.keys(ITEMS).filter((id) => bag.count(id) > 0 && ITEMS[id].category !== "evolution");
    for (;;) {
      this.clearUi();
      const g = this.add.graphics();
      g.fillStyle(0x283848, 0.94).fillRect(0, 0, W, H);
      this.ui.add(g);
      this.panel(200, 20, 420, 270);
      this.panel(20, 20, 170, 270);
      this.ui.add(txt(this, 44, 40, "TÚI ĐỒ", 18));
      const desc = txt(this, 40, 80, "", 13).setWordWrapWidth(140).setLineSpacing(4);
      this.ui.add(desc);
      if (!owned.length) {
        this.ui.add(txt(this, 230, 50, "Túi trống.", 16));
        await this.nextKey();
        this.clearUi();
        return null;
      }
      const items = owned.map((id, i) => txt(this, 236, 40 + i * 22, `${getItem(id)!.name.padEnd(16, " ")}×${bag.count(id)}`, 15));
      this.ui.add(items);
      const r = await this.grid(items, 1, 0, (i) => desc.setText(getItem(owned[i])!.desc));
      if (r === null) { this.clearUi(); return null; }
      const id = owned[r], item = getItem(id)!;
      if (item.category === "ball") { this.clearUi(); return { type: "item", itemId: id }; }
      const target = await this.pickPokemon(false, `Dùng ${item.name} cho Pokémon nào?`);
      if (target !== null) { this.clearUi(); return { type: "item", itemId: id, target }; }
    }
  }

  private async pickPokemon(forced: boolean, prompt: string): Promise<number | null> {
    const party = this.data_.setup.playerParty;
    for (;;) {
      this.clearUi();
      const g = this.add.graphics();
      g.fillStyle(0x3878a8, 1).fillRect(0, 0, W, H);
      for (let i = 0; i < 10; i++) g.fillStyle(0x4088b8, 1).fillRect(0, i * 40 + 20, W, 8);
      this.ui.add(g);
      const items: Phaser.GameObjects.Text[] = [];
      party.forEach((mon, i) => {
        const x = 30 + (i % 2) * 300, y = 20 + Math.floor(i / 2) * 92;
        const active = mon === this.engine.playerMon;
        const card = this.add.graphics();
        card.fillStyle(mon.hp > 0 ? (active ? 0xf8a050 : 0x58a8d8) : 0xa86060, 1).fillRoundedRect(x, y, 280, 80, 10);
        card.fillStyle(0xf8f8f0, 1).fillRoundedRect(x + 4, y + 4, 272, 72, 8);
        this.ui.add(card);
        const icon = this.add.image(x + 40, y + 42, spriteKey(mon.speciesId, "front")).setScale(3);
        const name = txt(this, x + 78, y + 10, displayName(mon), 15);
        const lv = txt(this, x + 210, y + 10, `Lv${mon.level}`, 14);
        const max = maxHp(mon), f = mon.hp / max;
        const barBg = this.add.rectangle(x + 78, y + 40, 150, 8, 0x404850).setOrigin(0, 0.5);
        const bar = this.add.rectangle(x + 79, y + 40, 148 * f, 6, hpColor(f)).setOrigin(0, 0.5);
        const hp = txt(this, x + 160, y + 52, `${mon.hp}/${max}`, 13);
        this.ui.add([icon, name, lv, barBg, bar, hp]);
        if (mon.status) this.ui.add(this.add.text(x + 78, y + 52, STATUS_LABEL[mon.status], { fontFamily: FONT, fontSize: "11px", color: "#fff", backgroundColor: STATUS_COLOR[mon.status], padding: { x: 3, y: 1 } }).setResolution(2));
        items.push(name);
      });
      this.panel(20, 300, 600, 90);
      this.ui.add(txt(this, 44, 320, prompt + (forced ? "" : "   (X: quay lại)"), 15).setWordWrapWidth(550));
      const r = await this.grid(items, 2, Math.max(0, this.engine.playerIndex), undefined, !forced);
      if (r === null) { this.clearUi(); return null; }
      if (party[r].hp <= 0) { this.clearUi(); await this.say(`${displayName(party[r])} đã kiệt sức!`); continue; }
      if (forced && party[r] === this.engine.playerMon) continue;
      this.clearUi();
      return r;
    }
  }

  private async yesNo(): Promise<boolean> {
    this.panel(500, 210, 130, 86);
    const items = [txt(this, 540, 228, "CÓ", 16), txt(this, 540, 258, "KHÔNG", 16)];
    this.ui.add(items);
    const r = await this.grid(items, 1, 0);
    this.clearUi();
    return r === 0;
  }

  private async learnPrompt(uid: string, moveId: string) {
    const mon = this.data_.setup.playerParty.find((m) => m.uid === uid);
    if (!mon) return;
    const name = displayName(mon), move = getMove(moveId);
    for (;;) {
      await this.say(`${name} muốn học ${move.name}.`);
      await this.say(`Nhưng ${name} đã biết 4 chiêu rồi.`);
      this.msg.setText(`Quên một chiêu để học ${move.name}?`);
      if (await this.yesNo()) {
        this.clearUi();
        this.panel(120, 40, 400, 240);
        this.ui.add(txt(this, 150, 56, "Chọn chiêu muốn quên:", 15));
        const items = mon.moves.map((m, i) => txt(this, 170, 96 + i * 34, `${getMove(m.id).name.padEnd(14, " ")} ${m.pp}/${m.maxPp}`, 15));
        const newItem = txt(this, 170, 96 + 4 * 34, `${move.name.padEnd(14, " ")} (mới)`, 15, "#4878c8");
        this.ui.add([...items, newItem]);
        const r = await this.grid([...items, newItem], 1, 0);
        this.clearUi();
        if (r === null || r === 4) {
          this.msg.setText(`Bỏ học ${move.name}?`);
          if (await this.yesNo()) { await this.play(this.engine.learnMove(uid, moveId, null)); return; }
          continue;
        }
        await this.play(this.engine.learnMove(uid, moveId, r));
        return;
      }
      this.msg.setText(`Bỏ học ${move.name}?`);
      if (await this.yesNo()) { await this.play(this.engine.learnMove(uid, moveId, null)); return; }
    }
  }

  private async evolveSequence(mon: PokemonInstance, into: string) {
    this.clearUi();
    const bg = this.add.rectangle(W / 2, PANEL_Y / 2, W, PANEL_Y, 0x101820).setDepth(45);
    const sprite = this.add.image(W / 2, 220, spriteKey(mon.speciesId, "front")).setOrigin(0.5, 1).setScale(8).setDepth(46);
    const before = displayName(mon);
    await this.say(`Ồ? ${before} đang tiến hóa!`);
    let cancelled = false;
    const onKey = (e: KeyboardEvent) => { if (["x", "X", "Escape", "Backspace"].includes(e.key)) cancelled = true; };
    this.input.keyboard!.on("keydown", onKey);
    for (let i = 0; i < 14 && !cancelled; i++) {
      sprite.setTexture(spriteKey(i % 2 ? into : mon.speciesId, "front")).setTintFill(0xffffff);
      await this.wait(Math.max(60, 260 - i * 15));
    }
    this.input.keyboard!.off("keydown", onKey);
    sprite.clearTint();
    if (cancelled) {
      sprite.setTexture(spriteKey(mon.speciesId, "front"));
      await this.say(`${before} đã ngừng tiến hóa.`);
    } else {
      sprite.setTexture(spriteKey(into, "front"));
      this.cameras.main.flash(300, 255, 255, 255);
      const res = evolve(mon, into);
      this.data_.setup.onSeen(into);
      this.data_.setup.onEvolved?.(into);
      await this.say(`Chúc mừng! ${before} đã tiến hóa thành ${getSpecies(into).name}!`);
      for (const id of res.learned) await this.say(`${displayName(mon)} đã học được ${getMove(id).name}!`);
      for (const id of res.pending) await this.learnPrompt(mon.uid, id);
    }
    bg.destroy(); sprite.destroy();
  }

  /* ------------------------------------------------------------ */
  /* Helpers                                                      */
  /* ------------------------------------------------------------ */

  private nextKey(): Promise<Key> { return new Promise((res) => (this.keyWaiter = res)); }
  private wait(ms: number) { return new Promise<void>((res) => this.time.delayedCall(ms, () => res())); }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((res) => this.tweens.add({ ...cfg, onComplete: () => res() }));
  }
}

export { viewOf };
