import Phaser from "phaser";
import { BattleEngine, viewOf, type BattleEvent, type BattleSetup, type MonView, type Outcome, type PlayerAction, type Side } from "../battle/BattleEngine";
import { hasBack, shinyKey, spriteKey } from "../battle/sprites";
import { ITEMS, getItem } from "../data/items";
import { getMove, type MoveData } from "../data/moves";
import { getSpecies } from "../data/species";
import { TYPE_COLORS, TYPE_VI, categoryOf } from "../data/types";
import { STATUS_COLOR, STATUS_LABEL, displayName, evolve, maxHp, type PokemonInstance } from "../core/pokemon";
import { CHAR_FRAME, ensureCharacterTexture } from "../world/TilesetFactory";
import { UI_FONT } from "../ui/DialogBox";
import { MoveFx } from "../battle/fx/MoveFx";

export interface BattleResult { outcome: Outcome; prizeMoney: number }
export interface BattleSceneData { setup: BattleSetup; onEnd: (r: BattleResult) => void }

type Key = "up" | "down" | "left" | "right" | "ok" | "back";
type Input = Key | { pick: number } | { focus: number };

const W = 640, H = 400, PANEL_Y = 288;
const FOE = { x: 470, y: 150 }, PLAYER = { x: 166, y: 286 };
const FOE_SCALE = 6, PLAYER_SCALE = 7;
const INK = "#404048", INK_SHADOW = "#d8d0c8";

const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
const lighten = (c: number, a: number) => Phaser.Display.Color.IntegerToColor(c).lighten(a).color;
const darken = (c: number, a: number) => Phaser.Display.Color.IntegerToColor(c).darken(a).color;
const hpColor = (f: number) => (f > 0.5 ? 0x58d080 : f > 0.2 ? 0xf8c030 : 0xf05858);
const BALL_COLORS: Record<string, [number, number]> = { "poke-ball": [0xe04040, 0xf8f8f8], "great-ball": [0x3878e0, 0xf8f8f8], "ultra-ball": [0x383838, 0xf8d030] };

interface InfoBox {
  root: Phaser.GameObjects.Container; name: Phaser.GameObjects.Text; level: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Rectangle; barW: number; status: Phaser.GameObjects.Text;
  hpText?: Phaser.GameObjects.Text; exp?: Phaser.GameObjects.Rectangle; expW?: number; view?: MonView;
}

interface Button { root: Phaser.GameObjects.Container; setFocus(on: boolean): void; enabled: boolean }

/**
 * FireRed-style battle UI. All rules live in BattleEngine; this scene only
 * collects player choices (keyboard, mouse or touch) and plays back events.
 */
export class BattleScene extends Phaser.Scene {
  private engine!: BattleEngine;
  private data_!: BattleSceneData;
  private waiter: ((i: Input) => void) | null = null;
  private awaitingText = false;
  private msg!: Phaser.GameObjects.Text;
  private msgArrow!: Phaser.GameObjects.Text;
  private ui!: Phaser.GameObjects.Container;
  private foeSprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private foeBox!: InfoBox;
  private playerBox!: InfoBox;
  private foeTrainer?: Phaser.GameObjects.Sprite;
  private playerTrainer?: Phaser.GameObjects.Sprite;
  private idle: Partial<Record<Side, Phaser.Tweens.Tween>> = {};
  private lastAction = 0;
  private lastMove = 0;
  private fx!: MoveFx;

  constructor() { super("BattleScene"); }

  init(data: BattleSceneData) { this.data_ = data; this.idle = {}; this.lastAction = 0; this.lastMove = 0; }

  create() {
    this.engine = new BattleEngine(this.data_.setup);
    this.makeFxTextures();
    this.drawBackground();
    this.fx = new MoveFx(this);
    this.foeSprite = this.add.image(FOE.x, FOE.y, "__DEFAULT").setOrigin(0.5, 1).setVisible(false).setDepth(5);
    this.playerSprite = this.add.image(PLAYER.x, PLAYER.y, "__DEFAULT").setOrigin(0.5, 1).setVisible(false).setDepth(6);
    this.foeBox = this.makeInfoBox(18, 20, false);
    this.playerBox = this.makeInfoBox(346, 172, true);
    this.drawMessageBox();
    this.ui = this.add.container(0, 0).setDepth(50);
    this.setupTrainers();
    this.setupKeyboard();
    this.cameras.main.fadeIn(350, 0, 0, 0);
    void this.run();
  }

  /* ------------------------------------------------------------ */
  /* Flow                                                         */
  /* ------------------------------------------------------------ */

  private async run() {
    await this.wait(250);
    await this.trainersEnter();
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
    await this.wait(300);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    await this.wait(430);
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
        const idx = await this.pickPokemon(false, "Chọn Pokémon để đổi ra trận.");
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
        case "recall": await this.recall(); break;
        case "move": await this.moveFx(e.side, e.move); break;
        case "hit": await this.hitAnim(e.side, e.eff); break;
        case "hp": await this.animateHp(e.side === "player" ? this.playerBox : this.foeBox, e.hp, e.maxHp); break;
        case "status": this.setStatus(e.side === "player" ? this.playerBox : this.foeBox, e.status); break;
        case "stat": await this.statAnim(e.side, e.up); break;
        case "faint": await this.faintAnim(e.side); break;
        case "ball": await this.catchAnim(e.ball, e.shakes, e.caught); break;
        case "exp": if (this.playerBox.view?.uid === e.uid) await this.animateExp(e.from, e.to); break;
        case "levelUp":
          if (this.playerBox.view?.uid === e.uid) {
            this.playerBox.view = e.mon;
            this.playerBox.level.setText(`Lv${e.mon.level}`);
            this.drawHp(this.playerBox, e.mon.hp, e.mon.maxHp);
            await this.levelUpFx();
          }
          break;
        case "learn": await this.learnPrompt(e.uid, e.moveId); break;
        case "end": break;
      }
    }
  }

  private async say(text: string, autoMs = 1700) {
    this.msg.setWordWrapWidth(580).setText("");
    this.msgArrow.setVisible(false);
    for (let i = 1; i <= text.length; i += 2) { this.msg.setText(text.slice(0, i)); await this.wait(11); }
    this.msg.setText(text);
    this.msgArrow.setVisible(true);
    this.awaitingText = true;
    await this.waitOk(autoMs);
    this.awaitingText = false;
    this.msgArrow.setVisible(false);
  }

  /** Waits for confirm/click, or auto-advances after `ms` so long turns keep flowing. */
  private waitOk(ms: number): Promise<void> {
    return new Promise((res) => {
      let done = false;
      const finish = () => { if (done) return; done = true; if (this.waiter === handler) this.waiter = null; res(); };
      const handler = (i: Input) => { if (i === "ok" || i === "back") finish(); else this.waiter = handler; };
      this.waiter = handler;
      this.time.delayedCall(ms, finish);
    });
  }

  /* ------------------------------------------------------------ */
  /* Input                                                        */
  /* ------------------------------------------------------------ */

  private setupKeyboard() {
    const map: Record<string, Key> = {
      ARROWUP: "up", W: "up", ARROWDOWN: "down", S: "down", ARROWLEFT: "left", A: "left", ARROWRIGHT: "right", D: "right",
      Z: "ok", ENTER: "ok", " ": "ok", X: "back", ESCAPE: "back", BACKSPACE: "back",
    };
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      const k = map[e.key.toUpperCase()];
      if (k) this.emit(k);
    });
  }

  private emit(i: Input) {
    if (!this.waiter) return;
    const fn = this.waiter;
    this.waiter = null;
    fn(i);
  }

  private nextInput(): Promise<Input> { return new Promise((res) => (this.waiter = res)); }

  /**
   * Shows buttons and resolves with the chosen index (null = back).
   * Works with arrows + Z/X, mouse hover/click and touch.
   */
  private async choose(buttons: Button[], cols: number, start: number, allowBack = true, onFocus?: (i: number) => void): Promise<number | null> {
    let i = Math.max(0, Math.min(start, buttons.length - 1));
    const focus = (n: number) => { buttons.forEach((b, j) => b.setFocus(j === n)); onFocus?.(n); };
    focus(i);
    for (;;) {
      const inp = await this.nextInput();
      if (typeof inp === "object") {
        if ("focus" in inp) { if (inp.focus !== i) { i = inp.focus; focus(i); } continue; }
        if (buttons[inp.pick]?.enabled !== false) return inp.pick;
        continue;
      }
      if (inp === "ok") { if (buttons[i].enabled !== false) return i; continue; }
      if (inp === "back") { if (allowBack) return null; continue; }
      const r = Math.floor(i / cols), c = i % cols, rows = Math.ceil(buttons.length / cols);
      let n = i;
      if (inp === "left" && c > 0) n--;
      if (inp === "right" && c < cols - 1 && i + 1 < buttons.length) n++;
      if (inp === "up" && r > 0) n -= cols;
      if (inp === "down" && r < rows - 1 && i + cols < buttons.length) n += cols;
      if (n !== i) { i = n; focus(i); }
    }
  }

  /** A clickable button; `index` is reported to choose(). Use index -1 for a "back" button. */
  private button(x: number, y: number, w: number, h: number, index: number, draw: (g: Phaser.GameObjects.Graphics, focused: boolean) => void, children: Phaser.GameObjects.GameObject[] = []): Button {
    const g = this.add.graphics();
    const zone = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const root = this.add.container(x, y, [g, ...children, zone]);
    this.ui.add(root);
    zone.on("pointerover", () => { if (index >= 0) this.emit({ focus: index }); });
    zone.on("pointerdown", () => this.emit(index >= 0 ? { pick: index } : "back"));
    const btn: Button = {
      root, enabled: true,
      setFocus: (on) => { g.clear(); draw(g, on); root.setY(on ? y - 1 : y); },
    };
    btn.setFocus(false);
    return btn;
  }

  private backButton(x: number, y: number) {
    const label = this.text(16, 6, "◀ QUAY LẠI", 22, "#ffffff", true);
    this.button(x, y, 136, 34, -1, (g, f) => {
      g.fillStyle(0x303848, 1).fillRoundedRect(0, 0, 136, 34, 8);
      g.fillStyle(f ? 0x7888a8 : 0x58688a, 1).fillRoundedRect(2, 2, 132, 30, 7);
    }, [label]);
  }

  private text(x: number, y: number, s: string, size = 24, color = INK, light = false) {
    return this.add.text(x, y, s, {
      fontFamily: UI_FONT, fontSize: `${size}px`, color,
      shadow: { offsetX: 2, offsetY: 2, color: light ? "rgba(0,0,0,0.35)" : INK_SHADOW, fill: true },
    }).setResolution(2);
  }

  /* ------------------------------------------------------------ */
  /* Drawing                                                      */
  /* ------------------------------------------------------------ */

  private makeFxTextures() {
    const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make("fx-dot", 12, 12, (g) => g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6));
    make("fx-sq", 6, 6, (g) => g.fillStyle(0xffffff, 1).fillRect(0, 0, 6, 6));
    make("fx-leaf2", 12, 8, (g) => g.fillStyle(0xffffff, 1).fillEllipse(6, 4, 12, 6));
    make("fx-shard", 8, 14, (g) => g.fillStyle(0xffffff, 1).fillTriangle(4, 0, 8, 14, 0, 14));
    make("fx-ring", 64, 64, (g) => g.lineStyle(4, 0xffffff, 1).strokeCircle(32, 32, 29));
    make("fx-star", 48, 48, (g) => {
      g.fillStyle(0xffffff, 1);
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 16; i++) { const r = i % 2 ? 9 : 24, a = (i / 16) * Math.PI * 2; pts.push(new Phaser.Math.Vector2(24 + Math.cos(a) * r, 24 + Math.sin(a) * r)); }
      g.fillPoints(pts, true);
    });
    make("fx-rock", 18, 16, (g) => { g.fillStyle(0x6c6458, 1).fillPoints([new Phaser.Math.Vector2(3, 0), new Phaser.Math.Vector2(15, 2), new Phaser.Math.Vector2(18, 12), new Phaser.Math.Vector2(9, 16), new Phaser.Math.Vector2(0, 10)], true); g.fillStyle(0xa8a090, 1).fillRect(4, 3, 6, 4); });
  }

  private drawBackground() {
    const g = this.add.graphics().setDepth(0);
    // Sky gradient in bands (keeps the pixel look)
    const sky = [0xf8f8e8, 0xf0f4e0, 0xe8f0d8, 0xe0ecd0, 0xd8e8c8, 0xd0e4c0];
    sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 16, W, 16));
    // Distant tree line
    g.fillStyle(0xb8d8a0, 1);
    for (let x = -10; x < W + 20; x += 26) g.fillCircle(x, 100 + ((x * 7) % 9), 22);
    g.fillStyle(0xa8cc90, 1).fillRect(0, 100, W, 18);
    // Field
    g.fillStyle(0xc8e4a8, 1).fillRect(0, 112, W, PANEL_Y - 112);
    for (let i = 0; i < 34; i++) g.fillStyle(i % 2 ? 0xb8d898 : 0xd8ecc0, 1).fillRect((i * 97) % W, 124 + ((i * 53) % 150), 14 + (i % 3) * 6, 3);
    // Platforms: rim, top, grass tufts
    const platform = (x: number, y: number, w: number, h: number) => {
      g.fillStyle(0x78a858, 1).fillEllipse(x, y + 4, w + 8, h + 8);
      g.fillStyle(0x98c878, 1).fillEllipse(x, y, w, h);
      g.fillStyle(0xb0dc90, 1).fillEllipse(x - w * 0.08, y - h * 0.12, w * 0.7, h * 0.5);
    };
    platform(FOE.x, FOE.y - 2, 236, 52);
    platform(PLAYER.x, PLAYER.y - 6, 290, 60);
    // Drifting clouds
    for (let i = 0; i < 3; i++) {
      const c = this.add.graphics().setDepth(1);
      c.fillStyle(0xffffff, 0.9).fillEllipse(0, 0, 70, 18).fillEllipse(20, -8, 46, 18).fillEllipse(-18, -4, 36, 14);
      c.setPosition(120 + i * 230, 30 + i * 14);
      this.tweens.add({ targets: c, x: c.x + 60, duration: 9000 + i * 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private drawMessageBox() {
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(0x283040, 1).fillRect(0, PANEL_Y, W, H - PANEL_Y);
    g.fillStyle(0xd06048, 1).fillRoundedRect(6, PANEL_Y + 6, W - 12, H - PANEL_Y - 12, 8);
    g.fillStyle(0xf8f8f0, 1).fillRoundedRect(12, PANEL_Y + 12, W - 24, H - PANEL_Y - 24, 6);
    g.lineStyle(2, 0xe8b8a8, 1).strokeRoundedRect(16, PANEL_Y + 16, W - 32, H - PANEL_Y - 32, 4);
    this.msg = this.text(30, PANEL_Y + 22, "", 28).setDepth(41).setLineSpacing(2).setWordWrapWidth(580);
    this.msgArrow = this.text(W - 46, H - 44, "▼", 24, "#e04848").setDepth(41).setVisible(false);
    this.tweens.add({ targets: this.msgArrow, y: H - 40, yoyo: true, repeat: -1, duration: 300 });
    const zone = this.add.zone(0, PANEL_Y, W, H - PANEL_Y).setOrigin(0, 0).setDepth(42).setInteractive();
    zone.on("pointerdown", () => { if (this.awaitingText) this.emit("ok"); });
  }

  private makeInfoBox(x: number, y: number, player: boolean): InfoBox {
    const w = player ? 278 : 270, h = player ? 100 : 72;
    const root = this.add.container(x, y).setDepth(20).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(4, 5, w, h, 10);
    g.fillStyle(0x404850, 1).fillRoundedRect(0, 0, w, h, 10);
    g.fillStyle(0xf8f8e0, 1).fillRoundedRect(3, 3, w - 6, h - 6, 8);
    g.fillStyle(0xe8e8c8, 1).fillRect(6, h - 14, w - 12, 8);
    g.fillStyle(0x404850, 1).fillRoundedRect(w - 196, 40, 180, 14, 5);
    root.add(g);
    const name = this.text(16, 4, "", 28);
    const level = this.text(w - 74, 6, "", 24);
    const hpLabel = this.text(w - 190, 38, "HP", 18, "#f8b030", true);
    const bar = this.add.rectangle(w - 164, 43, 144, 8, 0x58d080).setOrigin(0, 0);
    const status = this.add.text(16, 40, "", { fontFamily: UI_FONT, fontSize: "18px", color: "#ffffff", padding: { x: 5, y: 0 } }).setResolution(2).setVisible(false);
    root.add([name, level, hpLabel, bar, status]);
    const box: InfoBox = { root, name, level, bar, barW: 144, status };
    if (player) {
      box.hpText = this.text(w - 120, 54, "", 24);
      g.fillStyle(0x404850, 1).fillRoundedRect(52, h - 16, w - 66, 9, 3);
      box.exp = this.add.rectangle(55, h - 14, 0, 5, 0x58a8f0).setOrigin(0, 0);
      box.expW = w - 72;
      root.add([box.hpText, this.text(16, h - 24, "EXP", 16, "#4888c8"), box.exp]);
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
    const f = Math.max(0, Math.min(1, hp / max));
    box.bar.width = box.barW * f;
    box.bar.fillColor = hpColor(f);
    box.hpText?.setText(`${Math.ceil(hp)}/${max}`);
    if (box.view) { box.view.hp = hp; box.view.maxHp = max; }
  }

  private setStatus(box: InfoBox, s: MonView["status"]) {
    if (box.view) box.view.status = s;
    if (!s) { box.status.setVisible(false); return; }
    box.status.setText(STATUS_LABEL[s]).setBackgroundColor(STATUS_COLOR[s]).setVisible(true);
  }

  /* ------------------------------------------------------------ */
  /* Trainers & send-out                                          */
  /* ------------------------------------------------------------ */

  private setupTrainers() {
    const pKey = ensureCharacterTexture(this, "player");
    this.playerTrainer = this.add.sprite(PLAYER.x, PLAYER.y + 6, pKey, CHAR_FRAME.up).setOrigin(0.5, 1).setScale(5).setDepth(7).setX(-120);
    if (this.engine.isTrainer && this.data_.setup.trainerLook) {
      const fKey = ensureCharacterTexture(this, this.data_.setup.trainerLook);
      this.foeTrainer = this.add.sprite(W + 120, FOE.y + 4, fKey, CHAR_FRAME.down).setOrigin(0.5, 1).setScale(4.5).setDepth(5);
    }
  }

  private async trainersEnter() {
    const moves = [this.tween({ targets: this.playerTrainer, x: PLAYER.x, duration: 600, ease: "Quad.easeOut" })];
    if (this.foeTrainer) moves.push(this.tween({ targets: this.foeTrainer, x: FOE.x, duration: 600, ease: "Quad.easeOut" }));
    await Promise.all(moves);
  }

  private async sendOut(side: Side, v: MonView) {
    const sprite = side === "player" ? this.playerSprite : this.foeSprite;
    const box = side === "player" ? this.playerBox : this.foeBox;
    const scale = side === "player" ? PLAYER_SCALE : FOE_SCALE;
    const home = side === "player" ? PLAYER : FOE;
    this.stopIdle(side);
    const back = side === "player" && hasBack(this, v.speciesId);
    const view = back ? "back" : "front";
    sprite.setTexture(v.shiny ? shinyKey(this, v.speciesId, view) : spriteKey(v.speciesId, view)).setFlipX(side === "player" && !back);
    sprite.setPosition(home.x, home.y).setAlpha(1).clearTint();
    this.setView(box, v);

    if (side === "foe" && !this.engine.isTrainer && !this.foeTrainer && !sprite.visible) {
      // Wild Pokémon slide in across the field
      sprite.setVisible(true).setScale(scale).setX(-80).setTintFill(0x303030);
      await this.tween({ targets: sprite, x: home.x, duration: 650, ease: "Quad.easeOut" });
      sprite.clearTint();
    } else {
      const trainer = side === "player" ? this.playerTrainer : this.foeTrainer;
      if (trainer?.visible && trainer.x > -60 && trainer.x < W + 60) {
        await this.tween({ targets: trainer, x: side === "player" ? -120 : W + 120, duration: 420, ease: "Quad.easeIn" });
        trainer.setVisible(false);
      }
      await this.ballOpen(side, home);
      sprite.setVisible(true).setScale(0).setTintFill(0xffffff);
      await this.tween({ targets: sprite, scale, duration: 280, ease: "Back.easeOut" });
      sprite.clearTint();
    }
    if (v.shiny) await this.shinySparkle(sprite);
    await this.tween({ targets: box.root, alpha: 1, x: box.root.x, duration: 200 });
    this.startIdle(side);
  }

  private async shinySparkle(s: Phaser.GameObjects.Image) {
    const c = this.center(s);
    const stars = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const st = this.particle("fx-star", c.x + Math.cos(a) * 20, c.y + Math.sin(a) * 20, i % 2 ? 0xfff4a0 : 0xffffff, 34).setScale(0.2);
      return this.tween({ targets: st, x: c.x + Math.cos(a) * 64, y: c.y + Math.sin(a) * 64, scale: 0.7, alpha: 0, duration: 650, delay: i * 40 }).then(() => st.destroy());
    });
    await Promise.all(stars);
  }

  private async recall() {
    this.stopIdle("player");
    this.playerSprite.setTintFill(0xff6060);
    await this.tween({ targets: this.playerSprite, scale: 0, duration: 260 });
    this.playerSprite.setVisible(false).clearTint();
    await this.tween({ targets: this.playerBox.root, alpha: 0, duration: 150 });
  }

  private drawBall(ballId: string) {
    const [top, bottom] = BALL_COLORS[ballId] ?? BALL_COLORS["poke-ball"];
    const g = this.add.graphics();
    g.fillStyle(0x202020, 1).fillCircle(0, 0, 10);
    g.fillStyle(bottom, 1).fillCircle(0, 0, 8);
    g.fillStyle(top, 1); g.beginPath(); g.slice(0, 0, 8, Math.PI, 0, false); g.fillPath();
    g.fillStyle(0x202020, 1).fillRect(-8, -1, 16, 2);
    g.fillStyle(0xf8f8f8, 1).fillCircle(0, 0, 3);
    g.fillStyle(0xffffff, 0.8).fillRect(-5, -6, 3, 2);
    return g;
  }

  private async ballOpen(side: Side, home: { x: number; y: number }) {
    const from = side === "player" ? { x: 40, y: 230 } : { x: W - 30, y: 60 };
    const ball = this.add.container(from.x, from.y, [this.drawBall("poke-ball")]).setDepth(30);
    const tx = home.x, ty = home.y - 40, t = { v: 0 };
    await this.tween({ targets: t, v: 1, duration: 420, onUpdate: () => {
      ball.x = Phaser.Math.Linear(from.x, tx, t.v);
      ball.y = Phaser.Math.Linear(from.y, ty, t.v) - Math.sin(t.v * Math.PI) * 70;
      ball.rotation = t.v * 12;
    } });
    ball.destroy();
    const flash = this.add.circle(tx, ty, 10, 0xffffff, 0.95).setDepth(31);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, p = this.add.image(tx, ty, "fx-sq").setTint(0xfff0a0).setDepth(31);
      this.tweens.add({ targets: p, x: tx + Math.cos(a) * 46, y: ty + Math.sin(a) * 46, alpha: 0, duration: 360, onComplete: () => p.destroy() });
    }
    await this.tween({ targets: flash, scale: 5, alpha: 0, duration: 260 });
    flash.destroy();
  }

  private startIdle(side: Side) {
    const s = side === "player" ? this.playerSprite : this.foeSprite;
    const base = side === "player" ? PLAYER_SCALE : FOE_SCALE;
    this.stopIdle(side);
    s.setScale(base);
    this.idle[side] = this.tweens.add({ targets: s, scaleY: base * 1.035, duration: side === "player" ? 900 : 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private stopIdle(side: Side) {
    this.idle[side]?.stop();
    this.idle[side] = undefined;
    const s = side === "player" ? this.playerSprite : this.foeSprite;
    if (s?.visible) s.setScale(side === "player" ? PLAYER_SCALE : FOE_SCALE);
  }

  /* ------------------------------------------------------------ */
  /* Move effects                                                 */
  /* ------------------------------------------------------------ */

  private center(s: Phaser.GameObjects.Image) { return { x: s.x, y: s.y - s.displayHeight * 0.45 }; }

  private particle(key: string, x: number, y: number, tint: number, depth = 32) {
    return this.add.image(x, y, key).setTint(tint).setDepth(depth);
  }

  private async moveFx(side: Side, move: MoveData) {
    const user = side === "player" ? this.playerSprite : this.foeSprite;
    const target = side === "player" ? this.foeSprite : this.playerSprite;
    this.stopIdle(side);
    await this.fx.play(move, side, user, target);
    this.startIdle(side);
  }

  private async hitAnim(side: Side, eff: number) {
    const s = side === "player" ? this.playerSprite : this.foeSprite;
    if (eff > 1) this.cameras.main.shake(200, 0.01);
    const x = s.x;
    for (let i = 0; i < 3; i++) {
      s.setAlpha(0.2).setX(x + (i % 2 ? 4 : -4)); await this.wait(55);
      s.setAlpha(1).setX(x); await this.wait(55);
    }
  }

  private async animateHp(box: InfoBox, hp: number, max: number) {
    const from = box.view?.hp ?? hp;
    const o = { v: from };
    await this.tween({ targets: o, v: hp, duration: Math.min(800, 150 + Math.abs(from - hp) * 20), onUpdate: () => this.drawHp(box, o.v, max) });
    this.drawHp(box, hp, max);
  }

  private async animateExp(from: number, to: number) {
    const bar = this.playerBox.exp!, w = this.playerBox.expW!;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    bar.width = w * clamp(from);
    await this.tween({ targets: bar, width: w * clamp(to), duration: 450 + 700 * Math.abs(to - from) });
  }

  private async levelUpFx() {
    const s = this.playerSprite, c = this.center(s);
    const parts = Array.from({ length: 10 }, (_, i) => {
      const p = this.particle("fx-star", c.x + (i - 5) * 12, c.y + 50, 0xf8e070).setScale(0.25);
      return this.tween({ targets: p, y: c.y - 60, alpha: 0, duration: 620, delay: i * 30 }).then(() => p.destroy());
    });
    await Promise.all(parts);
  }

  private async statAnim(side: Side, up: boolean) {
    const s = side === "player" ? this.playerSprite : this.foeSprite;
    const c = this.center(s);
    s.setTint(up ? 0xa8c8ff : 0xffa8a8);
    const arrows = Array.from({ length: 5 }, (_, i) => this.text(c.x - 50 + i * 24, c.y + (up ? 30 : -60), up ? "▲" : "▼", 28, up ? "#4878f0" : "#e05050").setDepth(33));
    await Promise.all(arrows.map((a, i) => this.tween({ targets: a, y: a.y + (up ? -70 : 70), alpha: 0, duration: 560, delay: i * 50 })));
    arrows.forEach((a) => a.destroy());
    s.clearTint();
  }

  private async faintAnim(side: Side) {
    const s = side === "player" ? this.playerSprite : this.foeSprite;
    const box = side === "player" ? this.playerBox : this.foeBox;
    this.stopIdle(side);
    await this.tween({ targets: s, y: s.y + 80, alpha: 0, duration: 420, ease: "Quad.easeIn" });
    s.setVisible(false);
    await this.tween({ targets: box.root, alpha: 0, duration: 150 });
  }

  private async catchAnim(ballId: string, shakes: number, caught: boolean) {
    this.stopIdle("foe");
    const ball = this.add.container(110, 250, [this.drawBall(ballId)]).setDepth(35);
    const tx = this.foeSprite.x, ty = this.foeSprite.y - 70, t = { v: 0 };
    await this.tween({ targets: t, v: 1, duration: 560, onUpdate: () => {
      ball.x = Phaser.Math.Linear(110, tx, t.v);
      ball.y = Phaser.Math.Linear(250, ty, t.v) - Math.sin(t.v * Math.PI) * 130;
      ball.rotation = t.v * 12;
    } });
    ball.rotation = 0;
    this.foeSprite.setTintFill(0xffffff);
    await this.tween({ targets: this.foeSprite, scale: 0, y: ty + 10, duration: 260 });
    await this.tween({ targets: ball, y: FOE.y - 12, duration: 320, ease: "Bounce.easeOut" });
    for (let i = 0; i < shakes; i++) {
      await this.wait(320);
      await this.tween({ targets: ball, angle: 24, duration: 100, yoyo: true });
      await this.tween({ targets: ball, angle: -24, duration: 100, yoyo: true });
    }
    await this.wait(350);
    if (caught) {
      for (let i = 0; i < 3; i++) {
        const star = this.particle("fx-star", ball.x, ball.y - 6, 0xf8d030, 36).setScale(0.3);
        this.tweens.add({ targets: star, x: ball.x + (i - 1) * 34, y: ball.y - 46, alpha: 0, duration: 650, onComplete: () => star.destroy() });
      }
      await this.tween({ targets: ball, alpha: 0.75, duration: 300 });
      this.time.delayedCall(1800, () => ball.destroy());
    } else {
      ball.destroy();
      const flash = this.add.circle(FOE.x, FOE.y - 30, 8, 0xffffff).setDepth(36);
      this.tweens.add({ targets: flash, scale: 5, alpha: 0, duration: 250, onComplete: () => flash.destroy() });
      this.foeSprite.setY(FOE.y);
      await this.tween({ targets: this.foeSprite, scale: FOE_SCALE, duration: 240, ease: "Back.easeOut" });
      this.foeSprite.clearTint();
      this.startIdle("foe");
    }
  }

  /* ------------------------------------------------------------ */
  /* Menus                                                        */
  /* ------------------------------------------------------------ */

  private clearUi() { this.ui.removeAll(true); }

  private overlay(color = 0x283848, alpha = 0.95) {
    const g = this.add.graphics();
    g.fillStyle(color, alpha).fillRect(0, 0, W, H);
    const block = this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    this.ui.add([g, block]);
  }

  private panel(x: number, y: number, w: number, h: number) {
    const g = this.add.graphics();
    g.fillStyle(0x404850, 1).fillRoundedRect(x, y, w, h, 10);
    g.fillStyle(0xf8f8f0, 1).fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 8);
    this.ui.add(g);
  }

  private async actionMenu(): Promise<number> {
    this.clearUi();
    this.msg.setWordWrapWidth(300).setText(`${displayName(this.engine.playerMon)} sẽ làm gì?`);
    const defs: [string, number][] = [["ĐÁNH", 0xe05050], ["TÚI", 0xe8a030], ["POKéMON", 0x48a848], ["CHẠY", 0x4878d8]];
    const bw = 128, bh = 44;
    const buttons = defs.map(([label, col], i) => {
      const x = 362 + (i % 2) * (bw + 8), y = PANEL_Y + 12 + Math.floor(i / 2) * (bh + 8);
      const t = this.text(bw / 2, bh / 2 - 1, label, 28, "#ffffff", true).setOrigin(0.5);
      return this.button(x, y, bw, bh, i, (g, f) => {
        g.fillStyle(darken(col, 30), 1).fillRoundedRect(0, 2, bw, bh, 10);
        g.fillStyle(f ? lighten(col, 12) : col, 1).fillRoundedRect(0, 0, bw, bh - 2, 10);
        g.fillStyle(0xffffff, 0.22).fillRoundedRect(4, 3, bw - 8, 12, 6);
        if (f) g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(1, 1, bw - 2, bh - 4, 9);
      }, [t]);
    });
    const r = await this.choose(buttons, 2, this.lastAction, false);
    this.lastAction = r ?? 0;
    this.clearUi();
    return r ?? 0;
  }

  private async moveMenu(): Promise<number | null> {
    this.clearUi();
    this.msg.setText("");
    const mon = this.engine.playerMon;
    const g = this.add.graphics();
    g.fillStyle(0x283040, 1).fillRect(0, PANEL_Y, W, H - PANEL_Y);
    this.ui.add(g);
    this.panel(458, PANEL_Y + 6, 176, H - PANEL_Y - 12);
    const bw = 218, bh = 46;
    const buttons = mon.moves.map((m, i) => {
      const d = getMove(m.id), col = hex(TYPE_COLORS[d.type] ?? "#a8a878");
      const x = 10 + (i % 2) * (bw + 6), y = PANEL_Y + 8 + Math.floor(i / 2) * (bh + 6);
      const name = this.text(12, 4, d.name, 26, "#ffffff", true);
      const pp = this.text(bw - 10, 22, `${m.pp}/${m.maxPp}`, 20, m.pp === 0 ? "#ffd0d0" : "#ffffff", true).setOrigin(1, 0);
      const b = this.button(x, y, bw, bh, i, (gr, f) => {
        gr.fillStyle(darken(col, 35), 1).fillRoundedRect(0, 2, bw, bh, 9);
        gr.fillStyle(f ? lighten(col, 8) : darken(col, 8), 1).fillRoundedRect(0, 0, bw, bh - 2, 9);
        gr.fillStyle(0xffffff, 0.2).fillRoundedRect(4, 3, bw - 8, 10, 5);
        if (f) gr.lineStyle(3, 0xffffff, 1).strokeRoundedRect(1, 1, bw - 2, bh - 4, 8);
      }, [name, pp]);
      b.enabled = m.pp > 0;
      if (!b.enabled) b.root.setAlpha(0.55);
      return b;
    });
    // Info panel for the focused move
    const typeChip = this.add.text(472, PANEL_Y + 16, "", { fontFamily: UI_FONT, fontSize: "20px", color: "#fff", padding: { x: 8, y: 1 } }).setResolution(2);
    const cat = this.text(472, PANEL_Y + 42, "", 20);
    const pow = this.text(472, PANEL_Y + 62, "", 20);
    this.ui.add([typeChip, cat, pow]);
    this.backButtonSmall(476, PANEL_Y + 84 - 4);
    const desc = this.add.text(0, 0, "", { fontFamily: UI_FONT, fontSize: "20px", color: "#ffffff", backgroundColor: "#303848", padding: { x: 8, y: 4 }, wordWrap: { width: 440 } }).setResolution(2).setDepth(60).setVisible(false);
    this.ui.add(desc);
    const r = await this.choose(buttons, 2, Math.min(this.lastMove, buttons.length - 1), true, (i) => {
      const d = getMove(mon.moves[i].id);
      typeChip.setText(TYPE_VI[d.type].toUpperCase()).setBackgroundColor(TYPE_COLORS[d.type] ?? "#a8a878");
      cat.setText(d.power ? (categoryOf(d.type) === "physical" ? "Vật lý" : "Đặc biệt") : "Trạng thái");
      pow.setText(d.power ? `Sức mạnh ${d.power} · ${d.accuracy ?? "—"}%` : d.accuracy ? `Chính xác ${d.accuracy}%` : "Luôn trúng");
      desc.setText(d.desc).setPosition(12, PANEL_Y - desc.height - 6).setVisible(true);
    });
    this.clearUi();
    if (r === null) return null;
    this.lastMove = r;
    return r;
  }

  private backButtonSmall(x: number, y: number) {
    const label = this.text(12, 3, "◀ QUAY LẠI", 20, "#ffffff", true);
    this.button(x, y, 146, 28, -1, (g, f) => {
      g.fillStyle(0x303848, 1).fillRoundedRect(0, 0, 146, 28, 7);
      g.fillStyle(f ? 0x7888a8 : 0x58688a, 1).fillRoundedRect(2, 2, 142, 24, 6);
    }, [label]);
  }

  private listButton(x: number, y: number, w: number, h: number, i: number, left: string, right: string) {
    const a = this.text(28, h / 2 - 13, left, 24);
    const b = this.text(w - 14, h / 2 - 13, right, 24).setOrigin(1, 0);
    const cur = this.text(8, h / 2 - 13, "▶", 22, "#e04848");
    return this.button(x, y, w, h, i, (g, f) => {
      cur.setVisible(f);
      g.fillStyle(f ? 0xe0ecf8 : 0xf8f8f0, 1).fillRoundedRect(0, 0, w, h, 6);
      if (f) g.lineStyle(2, 0x88a8d0, 1).strokeRoundedRect(1, 1, w - 2, h - 2, 6);
    }, [cur, a, b]);
  }

  private async bagMenu(): Promise<PlayerAction | null> {
    const bag = this.data_.setup.bag;
    const owned = Object.keys(ITEMS).filter((id) => bag.count(id) > 0 && ITEMS[id].category !== "evolution");
    for (;;) {
      this.clearUi();
      this.overlay(0xc89040, 1);
      this.panel(196, 16, 428, 300);
      this.panel(16, 16, 172, 300);
      this.ui.add(this.text(36, 28, "TÚI ĐỒ", 32));
      const desc = this.text(32, 72, "", 22).setWordWrapWidth(140);
      this.ui.add(desc);
      this.backButton(24, 330);
      if (!owned.length) {
        this.ui.add(this.text(224, 40, "Túi trống.", 26));
        await this.choose([], 1, 0);
        this.clearUi();
        return null;
      }
      const buttons = owned.map((id, i) => this.listButton(206, 26 + i * 30, 408, 28, i, getItem(id)!.name, `×${bag.count(id)}`));
      const r = await this.choose(buttons, 1, 0, true, (i) => desc.setText(getItem(owned[i])!.desc));
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
      this.overlay(0x3878a8, 1);
      const stripes = this.add.graphics();
      for (let i = 0; i < 10; i++) stripes.fillStyle(0x4088b8, 1).fillRect(0, i * 40 + 20, W, 8);
      this.ui.add(stripes);
      const buttons = party.map((mon, i) => {
        const x = 20 + (i % 2) * 306, y = 16 + Math.floor(i / 2) * 90, w = 294, h = 80;
        const active = mon === this.engine.playerMon, fainted = mon.hp <= 0;
        const max = maxHp(mon), f = mon.hp / max;
        const icon = this.add.image(42, 42, spriteKey(mon.speciesId, "front")).setScale(3);
        const name = this.text(80, 6, displayName(mon), 26);
        const lv = this.text(w - 14, 8, `Lv${mon.level}`, 22).setOrigin(1, 0);
        const barBg = this.add.rectangle(80, 44, 150, 10, 0x404850).setOrigin(0, 0.5);
        const bar = this.add.rectangle(82, 44, 146 * f, 6, hpColor(f)).setOrigin(0, 0.5);
        const hp = this.text(w - 14, 50, `${mon.hp}/${max}`, 22).setOrigin(1, 0);
        const kids: Phaser.GameObjects.GameObject[] = [icon, name, lv, barBg, bar, hp];
        if (mon.status) kids.push(this.add.text(80, 54, STATUS_LABEL[mon.status], { fontFamily: UI_FONT, fontSize: "18px", color: "#fff", backgroundColor: STATUS_COLOR[mon.status], padding: { x: 4, y: 0 } }).setResolution(2));
        return this.button(x, y, w, h, i, (g, foc) => {
          const border = fainted ? 0xa86060 : active ? 0xf8a050 : 0x58a8d8;
          g.fillStyle(foc ? 0xffffff : border, 1).fillRoundedRect(0, 0, w, h, 12);
          g.fillStyle(fainted ? 0xf0d8d8 : 0xf8f8f0, 1).fillRoundedRect(4, 4, w - 8, h - 8, 9);
          if (foc) g.lineStyle(3, border, 1).strokeRoundedRect(2, 2, w - 4, h - 4, 11);
        }, kids);
      });
      this.panel(16, 296, forced ? 608 : 456, 88);
      this.ui.add(this.text(36, 312, prompt, 26).setWordWrapWidth(forced ? 560 : 410));
      if (!forced) this.backButton(480, 322);
      const r = await this.choose(buttons, 2, Math.max(0, this.engine.playerIndex), !forced);
      if (r === null) { this.clearUi(); return null; }
      if (party[r].hp <= 0) { this.clearUi(); await this.say(`${displayName(party[r])} đã kiệt sức, không thể chiến đấu!`); continue; }
      if (forced && party[r] === this.engine.playerMon) continue;
      this.clearUi();
      return r;
    }
  }

  private async yesNo(): Promise<boolean> {
    this.panel(494, 196, 136, 88);
    const buttons = ["CÓ", "KHÔNG"].map((l, i) => this.listButton(500, 204 + i * 38, 124, 34, i, l, ""));
    const r = await this.choose(buttons, 1, 0);
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
      this.msg.setWordWrapWidth(460).setText(`Quên một chiêu để học ${move.name}?`);
      if (await this.yesNo()) {
        this.clearUi();
        this.overlay(0x283848, 0.85);
        this.panel(110, 24, 420, 256);
        this.ui.add(this.text(134, 36, "Chọn chiêu muốn quên:", 26));
        const all = [...mon.moves.map((m) => ({ id: m.id, pp: `${m.pp}/${m.maxPp}` })), { id: moveId, pp: "MỚI" }];
        const buttons = all.map((m, i) => this.listButton(124, 72 + i * 40, 392, 36, i, getMove(m.id).name, m.pp));
        const r = await this.choose(buttons, 1, 0);
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
    const rays = this.add.graphics().setDepth(45);
    const sprite = this.add.image(W / 2, 220, spriteKey(mon.speciesId, "front")).setOrigin(0.5, 1).setScale(8).setDepth(46);
    const before = displayName(mon);
    await this.say(`Ồ? ${before} đang tiến hóa!`);
    let cancelled = false;
    const onKey = (e: KeyboardEvent) => { if (["x", "X", "Escape", "Backspace"].includes(e.key)) cancelled = true; };
    this.input.keyboard!.on("keydown", onKey);
    for (let i = 0; i < 16 && !cancelled; i++) {
      rays.clear().fillStyle(0x283860, 1);
      for (let r = 0; r < 12; r++) { const a = (r / 12) * Math.PI * 2 + i * 0.1; rays.fillTriangle(W / 2, 150, W / 2 + Math.cos(a) * 400, 150 + Math.sin(a) * 400, W / 2 + Math.cos(a + 0.2) * 400, 150 + Math.sin(a + 0.2) * 400); }
      sprite.setTexture(spriteKey(i % 2 ? into : mon.speciesId, "front")).setTintFill(0xffffff);
      await this.wait(Math.max(70, 280 - i * 15));
    }
    this.input.keyboard!.off("keydown", onKey);
    sprite.clearTint();
    if (cancelled) {
      sprite.setTexture(spriteKey(mon.speciesId, "front"));
      await this.say(`${before} đã ngừng tiến hóa.`);
    } else {
      sprite.setTexture(spriteKey(into, "front"));
      this.cameras.main.flash(400, 255, 255, 255);
      const res = evolve(mon, into);
      this.data_.setup.onSeen(into);
      this.data_.setup.onEvolved?.(into);
      await this.say(`Chúc mừng! ${before} đã tiến hóa thành ${getSpecies(into).name}!`);
      for (const id of res.learned) await this.say(`${displayName(mon)} đã học được ${getMove(id).name}!`);
      for (const id of res.pending) await this.learnPrompt(mon.uid, id);
    }
    bg.destroy(); rays.destroy(); sprite.destroy();
  }

  /* ------------------------------------------------------------ */
  /* Helpers                                                      */
  /* ------------------------------------------------------------ */

  private wait(ms: number) { return new Promise<void>((res) => this.time.delayedCall(ms, () => res())); }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((res) => this.tweens.add({ ...cfg, onComplete: () => res() }));
  }
}

export { viewOf };
