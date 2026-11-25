import Phaser from "phaser";
import { BattleEngine, viewOf, type BattleEvent, type BattleSetup, type MonView, type Outcome, type PlayerAction, type Side } from "../battle/BattleEngine";
import { hasBack, shinyKey, spriteKey } from "../battle/sprites";
import { ITEMS, getItem } from "../data/items";
import { getMove, type MoveData } from "../data/moves";
import { getSpecies } from "../data/species";
import { TYPE_COLORS, TYPE_VI, categoryOf, effectiveness } from "../data/types";
import { STATUS_COLOR, STATUS_LABEL, displayName, evolve, maxHp, type PokemonInstance } from "../core/pokemon";
import { CHAR_FRAME, ensureCharacterTexture } from "../world/TilesetFactory";
import { UI_FONT } from "../ui/DialogBox";
import { MoveFx } from "../battle/fx/MoveFx";
import { gameAudio } from "../audio/GameAudio";
import { session } from "../core/GameSession";
import { ELEMENT_INFO, ENERGY_MAX, SURGE_MAX, elementOf, energyCost, type Element } from "../battle/elements";

export interface BattleResult { outcome: Outcome; prizeMoney: number }
export interface BattleSceneData {
  setup: BattleSetup; onEnd: (r: BattleResult) => void;
  /** Dev-only effect demo: a move id, or "ult" for the ultimate. Actions are chosen automatically. */
  demo?: string;
}

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
/** Bond crystal colours (core, glow) per tier. */
const CRYSTAL_COLORS: Record<string, [number, number]> = { "poke-ball": [0x7ad8ff, 0xd8f6ff], "great-ball": [0x5a7cff, 0xc8d4ff], "ultra-ball": [0xffc83a, 0xfff2b0] };
const CRYSTALS = ["poke-ball", "great-ball", "ultra-ball"];

interface Hud { root: Phaser.GameObjects.Container; pips: Phaser.GameObjects.Rectangle[]; surge: Phaser.GameObjects.Rectangle; surgeW: number; label: Phaser.GameObjects.Text; glow?: Phaser.Tweens.Tween }

interface InfoBox {
  root: Phaser.GameObjects.Container; name: Phaser.GameObjects.Text; level: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Rectangle; barW: number; status: Phaser.GameObjects.Text;
  hpText?: Phaser.GameObjects.Text; exp?: Phaser.GameObjects.Rectangle; expW?: number; caught?: Phaser.GameObjects.Text; view?: MonView;
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
  /** Screen-space HUD lives on its own camera so the world camera can zoom/pan cinematically. */
  private uiLayer!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private msgRoot!: Phaser.GameObjects.Container;
  /** Info boxes + energy strips; faded while a move plays so the effect isn't hidden. */
  private hudGroup!: Phaser.GameObjects.Container;
  private hud!: Record<Side, Hud>;
  private markIcon!: Record<Side, Phaser.GameObjects.Container>;
  private shadows!: Record<Side, Phaser.GameObjects.Ellipse>;
  private qteActive = false;

  constructor() { super("BattleScene"); }

  init(data: BattleSceneData) { this.data_ = data; this.idle = {}; this.lastAction = 0; this.lastMove = 0; }

  create() {
    this.engine = new BattleEngine(this.data_.setup);
    this.makeFxTextures();
    this.setupCameras();
    this.drawBackground();
    this.fx = new MoveFx(this, { uiAdd: (o) => this.uiLayer.add(o), setHud: (v) => this.setHudVisible(v) });
    this.shadows = {
      foe: this.add.ellipse(FOE.x, FOE.y - 2, 130, 24, 0x000000, 0.28).setDepth(4.9).setVisible(false),
      player: this.add.ellipse(PLAYER.x, PLAYER.y - 4, 170, 30, 0x000000, 0.28).setDepth(4.9).setVisible(false),
    };
    this.foeSprite = this.add.image(FOE.x, FOE.y, "__DEFAULT").setOrigin(0.5, 1).setVisible(false).setDepth(5);
    this.playerSprite = this.add.image(PLAYER.x, PLAYER.y, "__DEFAULT").setOrigin(0.5, 1).setVisible(false).setDepth(6);
    this.markIcon = { foe: this.makeMarkIcon(FOE.x + 92, FOE.y - 118), player: this.makeMarkIcon(PLAYER.x + 112, PLAYER.y - 168) };
    this.foeBox = this.makeInfoBox(18, 20, false);
    this.playerBox = this.makeInfoBox(346, 172, true);
    this.hud = { foe: this.makeHud(18, 96), player: this.makeHud(354, 274) };
    this.drawMessageBox();
    this.ui = this.add.container(0, 0).setDepth(50);
    this.hudGroup = this.add.container(0, 0, [this.foeBox.root, this.playerBox.root, this.hud.foe.root, this.hud.player.root]);
    this.uiLayer.add([this.hudGroup, this.msgRoot, this.ui]);
    this.setupTrainers();
    this.setupKeyboard();
    this.input.on("pointerdown", () => { if (this.qteActive) this.emit("ok"); });
    this.cameras.main.fadeIn(350, 0, 0, 0);
    this.uiCam.fadeIn(350, 0, 0, 0);
    void this.run();
  }

  /** World camera (zoomable, cinematic) + UI camera (fixed HUD). */
  private setupCameras() {
    this.uiLayer = this.add.layer().setDepth(1000);
    this.uiCam = this.cameras.add(0, 0, W, H);
    this.cameras.main.ignore(this.uiLayer).setBounds(0, 0, W, H);
    // Every world object created at any time (effects included) is hidden from the UI camera.
    const filter = () => {
      const id = this.uiCam.id;
      for (const o of this.children.list) if ((o as unknown) !== this.uiLayer) o.cameraFilter |= id;
    };
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, filter);
    filter();
  }

  private setHudVisible(v: boolean) {
    [this.hudGroup, this.msgRoot, this.ui].forEach((o) => o.setVisible(v));
  }

  /* ------------------------------------------------------------ */
  /* Flow                                                         */
  /* ------------------------------------------------------------ */

  private async run() {
    await this.wait(250);
    await this.trainersEnter();
    await this.play(this.engine.intro());
    if (!this.data_.demo) await this.tutorial();
    if (this.data_.setup.boss) {
      await this.say("⚠ Hộ Vệ bắt đầu với thanh BỘC PHÁT nạp sẵn một nửa!");
      await this.say("Khi thanh của nó đầy, nó sẽ tung TUYỆT KỸ. Hãy chọn THỦ đúng lúc để giảm sát thương!");
    }
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
    this.uiCam.fadeOut(400, 0, 0, 0);
    await this.wait(430);
    const result = { outcome: this.engine.outcome ?? "run", prizeMoney: this.engine.prizeMoney };
    if (result.outcome === "caught") gameAudio.play("catch");
    else if (result.outcome === "win") gameAudio.play("victory");
    else if (result.outcome === "lose") gameAudio.play("defeat");
    this.scene.stop();
    this.data_.onEnd(result);
  }

  private async chooseAction(): Promise<PlayerAction | null> {
    const demo = this.data_.demo;
    if (demo && demo !== "menu") {
      this.engine.debugCharge("player");
      this.setEnergy("player", this.engine.energy("player"), this.engine.surge("player"));
      if (demo === "ult") return { type: "ultimate", timing: 1.3 };
      const mon = this.engine.playerMon;
      mon.moves[0] = { id: demo, pp: 10, maxPp: 10 };
      return { type: "move", index: 0, timing: 1.3 };
    }
    for (;;) {
      const choice = await this.actionMenu();
      if (choice === 0) {
        const idx = await this.moveMenu();
        if (idx !== null) {
          const move = getMove(this.engine.playerMon.moves[idx].id);
          const timing = move.power > 0 ? await this.timingCheck() : 1;
          return { type: "move", index: idx, timing };
        }
      } else if (choice === 1) {
        return { type: "guard" };
      } else if (choice === 2) {
        if (!this.engine.surgeReady("player")) { await this.say(`Thanh BỘC PHÁT mới ${Math.floor(this.engine.surge("player"))}%. Gây và nhận sát thương, tạo phản ứng để nạp đầy!`); continue; }
        const ult = this.engine.ultimateMove("player");
        await this.say(`TUYỆT KỸ: ${ult.name} (${TYPE_VI[ult.type]} · ${ult.power} sức mạnh). Giữ nhịp để tăng uy lực!`, 1200);
        return { type: "ultimate", timing: await this.timingCheck() };
      } else if (choice === 3) {
        const item = await this.bagMenu();
        if (item) return item;
      } else if (choice === 4) {
        const idx = await this.pickPokemon(false, "Chọn Pokémon để đổi ra trận.");
        if (idx !== null) {
          if (this.data_.setup.playerParty[idx] === this.engine.playerMon) { await this.say(`${displayName(this.engine.playerMon)} đang chiến đấu rồi!`); continue; }
          return { type: "switch", index: idx };
        }
      } else if (choice === 5) {
        if (this.engine.isTrainer) { await this.say("Không thể kết nối với Pokémon của Trainer khác!"); continue; }
        const bond = await this.bondMenu();
        if (bond) return bond;
      } else if (choice === 6) {
        return { type: "run" };
      }
    }
  }

  /** First battle: explain the three systems that differ from classic monster battlers. */
  private async tutorial() {
    if (session.hasFlag("tut:battle-v2")) return;
    session.setFlag("tut:battle-v2");
    session.save();
    await this.say("HƯỚNG DẪN · Mỗi chiêu tốn NĂNG LƯỢNG (thanh xanh). Chiêu yếu miễn phí, chiêu mạnh cần tích lũy.");
    await this.say("Chọn THỦ để giảm nửa sát thương và nạp thêm 3 năng lượng. Mỗi lượt tự hồi 2.");
    await this.say("Đòn nguyên tố để lại DẤU ẤN trên đối thủ. Đánh nguyên tố khác vào dấu ấn sẽ tạo PHẢN ỨNG cực mạnh!");
    await this.say("Khi ra đòn, nhấn Z (hoặc chạm) lúc vòng sáng trùng vòng trắng để đạt nhịp HOÀN HẢO.");
    await this.say("Thanh BỘC PHÁT đầy thì mở khóa TUYỆT KỸ. Muốn có bạn đồng hành mới, chọn KẾT NỐI khi đối thủ đã yếu.");
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
        case "move": gameAudio.play("attack"); await this.moveFx(e.side, e.move); break;
        case "hit": this.popDamage(e.side, e.damage ?? 0, !!e.crit, e.eff); await this.hitAnim(e.side, e.eff); break;
        case "energy": this.setEnergy(e.side, e.energy, e.surge); break;
        case "mark": this.setMark(e.side, e.mark, e.turns); break;
        case "reaction": await this.reactionBanner(e.side, e.name, e.color); break;
        case "guard": await this.guardFx(e.side); break;
        case "ultimate": gameAudio.play("encounter"); break;
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
      if (e.key >= "1" && e.key <= "4") {
        this.emit({ pick: Number(e.key) - 1 });
        return;
      }
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

  /**
   * Layered battlefield with real perspective: gradient sky, far mountains,
   * hills and tree line on parallax layers (scrollFactor < 1, so cinematic
   * camera pans reveal depth), a ground plane with lines converging to a
   * vanishing point, and thick 3D platform discs with soft shadows.
   */
  private drawBackground() {
    const tex = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      draw(cv.getContext("2d")!);
      this.textures.addCanvas(key, cv);
    };
    const HORIZON = 118;
    tex("bt-sky", 960, 200, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 200);
      g.addColorStop(0, "#5fb6f0"); g.addColorStop(0.55, "#a9dcf8"); g.addColorStop(1, "#fff1d6");
      c.fillStyle = g; c.fillRect(0, 0, 960, 200);
      const sun = c.createRadialGradient(760, 60, 0, 760, 60, 150);
      sun.addColorStop(0, "rgba(255,252,230,1)"); sun.addColorStop(0.12, "rgba(255,246,200,0.9)"); sun.addColorStop(0.4, "rgba(255,230,170,0.25)"); sun.addColorStop(1, "rgba(255,230,170,0)");
      c.fillStyle = sun; c.fillRect(0, 0, 960, 200);
    });
    tex("bt-mountains", 960, 90, (c) => {
      const layer = (color: string, base: number, amp: number, seed: number) => {
        c.fillStyle = color; c.beginPath(); c.moveTo(0, 90);
        for (let x = 0; x <= 960; x += 12) c.lineTo(x, base - Math.abs(Math.sin(x * 0.006 + seed)) * amp - Math.sin(x * 0.031 + seed * 3) * amp * 0.18);
        c.lineTo(960, 90); c.closePath(); c.fill();
      };
      layer("rgba(150,180,215,0.85)", 70, 55, 1.3);
      layer("rgba(120,160,190,0.9)", 84, 34, 4.1);
    });
    tex("bt-hills", 960, 60, (c) => {
      c.fillStyle = "#7fbf72"; c.beginPath(); c.moveTo(0, 60);
      for (let x = 0; x <= 960; x += 8) c.lineTo(x, 34 - Math.sin(x * 0.012) * 12 - Math.sin(x * 0.047) * 4);
      c.lineTo(960, 60); c.closePath(); c.fill();
      // tree line silhouettes with a lit top edge
      for (let x = -10; x < 980; x += 22) {
        const h = 16 + ((x * 37) % 11);
        c.fillStyle = "#4f9a58"; c.beginPath(); c.ellipse(x, 52 - h / 2, 14, h, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(190,240,170,0.45)"; c.beginPath(); c.ellipse(x - 4, 52 - h, 7, 4, 0, 0, Math.PI * 2); c.fill();
      }
    });
    tex("bt-ground", 640, PANEL_Y - HORIZON + 120, (c) => {
      const h = PANEL_Y - HORIZON + 120;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#b8e09a"); g.addColorStop(0.35, "#94cf78"); g.addColorStop(1, "#5ea44c");
      c.fillStyle = g; c.fillRect(0, 0, 640, h);
      // Perspective rows (closer = further apart) and lines converging to the vanishing point.
      c.strokeStyle = "rgba(255,255,255,0.10)"; c.lineWidth = 1;
      for (let i = 1; i < 14; i++) { const y = Math.pow(i / 14, 1.8) * h; c.beginPath(); c.moveTo(0, y); c.lineTo(640, y); c.stroke(); }
      for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(320 + i * 14, 0); c.lineTo(320 + i * 120, h); c.stroke(); }
      // Grass tufts that grow with proximity.
      for (let i = 0; i < 160; i++) {
        const t = Math.pow(Math.random(), 0.7), y = t * h, x = Math.random() * 640, s = 1 + t * 4;
        c.strokeStyle = Math.random() < 0.5 ? "rgba(60,120,50,0.55)" : "rgba(220,250,190,0.5)";
        c.lineWidth = Math.max(1, s * 0.45);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - s, y - s * 2); c.moveTo(x, y); c.lineTo(x + s * 0.6, y - s * 2.4); c.stroke();
      }
    });
    tex("bt-platform", 320, 110, (c) => {
      // Thick disc: dark side band, then lit top with rim highlight.
      c.fillStyle = "#4a7a3c"; c.beginPath(); c.ellipse(160, 62, 150, 40, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#3a6430"; c.fillRect(10, 50, 300, 12);
      const top = c.createRadialGradient(130, 40, 10, 160, 50, 160);
      top.addColorStop(0, "#d0f0a8"); top.addColorStop(0.55, "#9ccf78"); top.addColorStop(1, "#6fa858");
      c.fillStyle = top; c.beginPath(); c.ellipse(160, 50, 150, 40, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(255,255,230,0.55)"; c.lineWidth = 2; c.beginPath(); c.ellipse(160, 50, 146, 37, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    });

    this.add.image(320, 100, "bt-sky").setDepth(0).setScrollFactor(0.15);
    this.add.image(320, HORIZON - 40, "bt-mountains").setDepth(0.2).setScrollFactor(0.3);
    this.add.image(320, HORIZON - 26, "bt-hills").setDepth(0.4).setScrollFactor(0.55);
    this.add.image(320, HORIZON, "bt-ground").setOrigin(0.5, 0).setDepth(0.6);
    // Sunlight shafts drifting over the field.
    const shafts = this.add.graphics().setDepth(0.7).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12);
    for (let i = 0; i < 4; i++) shafts.fillStyle(0xfff6d0, 1).fillTriangle(560 + i * 40, 0, 300 + i * 90, PANEL_Y, 360 + i * 90, PANEL_Y);
    this.tweens.add({ targets: shafts, alpha: 0.05, duration: 3200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add.image(FOE.x, FOE.y + 8, "bt-platform").setDepth(0.8).setScale(0.82, 0.7);
    this.add.image(PLAYER.x, PLAYER.y + 8, "bt-platform").setDepth(0.8).setScale(1.02, 0.82);
    // Drifting clouds on their own slow parallax layer.
    for (let i = 0; i < 4; i++) {
      const c = this.add.graphics().setDepth(0.1).setScrollFactor(0.2);
      c.fillStyle(0xffffff, 0.85).fillEllipse(0, 0, 80, 18).fillEllipse(22, -8, 50, 20).fillEllipse(-20, -4, 40, 14);
      c.fillStyle(0xd8ecff, 0.6).fillEllipse(4, 6, 80, 8);
      c.setPosition(80 + i * 190, 24 + (i % 2) * 22);
      this.tweens.add({ targets: c, x: c.x + 70, duration: 10000 + i * 2400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private drawMessageBox() {
    this.msgRoot = this.add.container(0, 0).setDepth(40);
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
    this.msgRoot.add([g, this.msg, this.msgArrow, zone]);
  }

  /* ------------------------------------------------------------ */
  /* Energy / Surge / Mark HUD                                    */
  /* ------------------------------------------------------------ */

  private makeHud(x: number, y: number): Hud {
    const root = this.add.container(x, y).setDepth(20);
    const g = this.add.graphics();
    g.fillStyle(0x101824, 0.82).fillRoundedRect(0, 0, 270, 16, 6);
    g.lineStyle(1, 0x5878a8, 0.8).strokeRoundedRect(0, 0, 270, 16, 6);
    const nl = this.text(5, -3, "NL", 16, "#7fe6ff", true);
    const pips = Array.from({ length: ENERGY_MAX }, (_, i) => this.add.rectangle(26 + i * 15, 4, 12, 8, 0x203040).setOrigin(0, 0));
    const label = this.text(182, -3, "BP", 16, "#ffcf6a", true);
    const barBg = this.add.rectangle(204, 5, 60, 6, 0x302418).setOrigin(0, 0);
    const surge = this.add.rectangle(204, 5, 0, 6, 0xffb030).setOrigin(0, 0);
    root.add([g, nl, ...pips, label, barBg, surge]);
    return { root, pips, surge, surgeW: 60, label };
  }

  private setEnergy(side: Side, energy: number, surge: number) {
    const h = this.hud[side];
    h.pips.forEach((p, i) => p.setFillStyle(i < energy ? (i >= 8 ? 0xb0f4ff : 0x38d0ff) : 0x203040));
    const f = Math.max(0, Math.min(1, surge / SURGE_MAX));
    this.tweens.add({ targets: h.surge, width: h.surgeW * f, duration: 260 });
    const ready = f >= 1;
    if (ready && !h.glow) {
      h.label.setText("BP!").setColor("#fff2a0");
      h.surge.setFillStyle(0xfff0a0);
      h.glow = this.tweens.add({ targets: [h.surge, h.label], alpha: 0.45, duration: 320, yoyo: true, repeat: -1 });
      if (side === "player" && !session.hasFlag("tut:surge")) {
        session.setFlag("tut:surge");
        void this.popText(this.center(this.playerSprite), "TUYỆT KỸ SẴN SÀNG!", 0xffe070, 26);
      }
    } else if (!ready && h.glow) {
      h.glow.stop(); h.glow = undefined;
      h.label.setText("BP").setColor("#ffcf6a").setAlpha(1);
      h.surge.setFillStyle(0xffb030).setAlpha(1);
    }
  }

  private makeMarkIcon(x: number, y: number) {
    const c = this.add.container(x, y).setDepth(33).setVisible(false);
    const g = this.add.graphics();
    const glyph = this.add.text(0, -2, "", { fontFamily: "serif", fontSize: "22px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setResolution(2);
    const label = this.text(0, 14, "", 15, "#ffffff", true).setOrigin(0.5, 0);
    c.add([g, glyph, label]);
    c.setData({ g, glyph, label });
    return c;
  }

  private setMark(side: Side, mark: Element | null, turns: number) {
    const c = this.markIcon[side];
    if (!mark) {
      if (c.visible) this.tweens.add({ targets: c, scale: 1.6, alpha: 0, duration: 200, onComplete: () => c.setVisible(false).setScale(1).setAlpha(1) });
      return;
    }
    const info = ELEMENT_INFO[mark];
    const g = c.getData("g") as Phaser.GameObjects.Graphics;
    g.clear().fillStyle(0x0c1018, 0.85).fillCircle(0, 0, 17).lineStyle(3, info.color, 1).strokeCircle(0, 0, 17);
    (c.getData("glyph") as Phaser.GameObjects.Text).setText(info.glyph).setColor(info.css);
    (c.getData("label") as Phaser.GameObjects.Text).setText(`ẤN ${info.name.toUpperCase()} ·${turns}`);
    if (!c.visible) { c.setVisible(true).setScale(0); this.tweens.add({ targets: c, scale: 1, duration: 260, ease: "Back.easeOut" }); }
  }

  /** Floating damage number, bigger and gold on crits / super-effective hits. */
  private popDamage(side: Side, damage: number, crit: boolean, eff: number) {
    if (damage <= 0) return;
    const s = side === "player" ? this.playerSprite : this.foeSprite, c = this.center(s);
    const color = crit ? 0xffd040 : eff > 1 ? 0xff8a4a : eff < 1 ? 0xb8c0d0 : 0xffffff;
    void this.popText({ x: c.x + Phaser.Math.Between(-20, 20), y: c.y - 10 }, `${damage}${crit ? "!" : ""}`, color, crit || eff > 1 ? 34 : 28);
  }

  private async popText(p: { x: number; y: number }, text: string, color: number, size = 28) {
    const t = this.add.text(p.x, p.y, text, {
      fontFamily: UI_FONT, fontSize: `${size}px`, color: "#" + color.toString(16).padStart(6, "0"), stroke: "#101018", strokeThickness: 5,
    }).setOrigin(0.5).setResolution(2).setDepth(62).setScale(0.4);
    await this.tween({ targets: t, scale: 1.15, y: p.y - 24, duration: 160, ease: "Back.easeOut" });
    await this.tween({ targets: t, scale: 1, y: p.y - 46, alpha: 0, duration: 620, delay: 240 });
    t.destroy();
  }

  /** Reaction name slammed onto the screen with an extruded 3D look. */
  private async reactionBanner(side: Side, name: string, color: number) {
    const s = side === "player" ? this.playerSprite : this.foeSprite, c = this.center(s);
    const ring = this.add.image(c.x, c.y, "vfx-ring").setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(40).setScale(0.2);
    this.tween({ targets: ring, scale: 2.4, alpha: 0, duration: 520 }).then(() => ring.destroy());
    this.cameras.main.flash(120, (color >> 16) & 255, (color >> 8) & 255, color & 255, true);
    const box = this.add.container(320, 112).setDepth(500);
    this.uiLayer.add(box);
    const css = "#" + color.toString(16).padStart(6, "0");
    for (let i = 5; i >= 1; i--) {
      const shade = Phaser.Display.Color.IntegerToColor(color).darken(25 + i * 8).color;
      box.add(this.add.text(i * 1.4, i * 1.4, name, { fontFamily: UI_FONT, fontSize: "44px", color: "#" + shade.toString(16).padStart(6, "0") }).setOrigin(0.5).setResolution(2));
    }
    box.add(this.add.text(0, 0, name, { fontFamily: UI_FONT, fontSize: "44px", color: "#ffffff", stroke: css, strokeThickness: 5 }).setOrigin(0.5).setResolution(2));
    box.add(this.text(0, -36, "PHẢN ỨNG NGUYÊN TỐ", 18, css, true).setOrigin(0.5));
    box.setScale(2.2).setAlpha(0);
    await this.tween({ targets: box, scale: 1, alpha: 1, duration: 180, ease: "Back.easeOut" });
    this.cameras.main.shake(160, 0.008);
    await this.wait(520);
    await this.tween({ targets: box, alpha: 0, y: 92, duration: 200 });
    box.destroy();
  }

  private async guardFx(side: Side) {
    const s = side === "player" ? this.playerSprite : this.foeSprite, c = this.center(s);
    const ADD = Phaser.BlendModes.ADD;
    const dome = this.add.image(c.x, c.y + 10, "vfx-ring").setTint(0x7fd8ff).setBlendMode(ADD).setDepth(34).setScale(0.3, 0.3);
    const disc = this.add.image(0, 0, "vfx-circle").setTint(0x7fd8ff).setBlendMode(ADD);
    const floor = this.add.container(s.x, s.y - 4, [disc]).setDepth(4.8).setScale(0.1, 0.03);
    await Promise.all([
      this.tween({ targets: dome, scaleX: 1.2, scaleY: 1.3, duration: 260, ease: "Back.easeOut" }),
      this.tween({ targets: floor, scaleX: 0.85, scaleY: 0.25, duration: 300, ease: "Back.easeOut" }),
      this.tween({ targets: disc, angle: 90, duration: 300 }),
    ]);
    await this.wait(220);
    await this.tween({ targets: [dome, floor], alpha: 0, duration: 260 });
    dome.destroy(); floor.destroy();
  }

  /* ------------------------------------------------------------ */
  /* Rhythm check (timing QTE)                                    */
  /* ------------------------------------------------------------ */

  /** A ring shrinks onto the foe; confirm when it overlaps the white circle. Returns the damage multiplier. */
  private async timingCheck(): Promise<number> {
    this.clearUi();
    const c = this.center(this.foeSprite), R0 = 120, TARGET = 34, DUR = 950;
    const target = this.add.circle(c.x, c.y, TARGET).setStrokeStyle(3, 0xffffff, 0.95).setDepth(60);
    const zoneRing = this.add.circle(c.x, c.y, TARGET).setStrokeStyle(16, 0xffffff, 0.12).setDepth(60);
    const ring = this.add.circle(c.x, c.y, R0).setStrokeStyle(5, 0xffe060, 1).setDepth(60);
    const hint = this.text(c.x, c.y + TARGET + 22, "Z / CHẠM!", 20, "#ffffff", true).setOrigin(0.5).setDepth(60);
    this.msg.setWordWrapWidth(580).setText("Nhấn Z đúng lúc vòng vàng chạm vòng trắng!");
    const t0 = this.time.now;
    let pressedAt = -1;
    this.qteActive = true;
    const shrink = this.tweens.add({ targets: ring, radius: 0, duration: DUR, onUpdate: () => ring.setStrokeStyle(5, Math.abs(ring.radius - TARGET) <= 7 ? 0x80ff90 : 0xffe060, 1) });
    await new Promise<void>((res) => {
      const handler = (i: Input) => {
        if (i === "ok" || (typeof i === "object" && "pick" in i)) { pressedAt = this.time.now; res(); } else this.waiter = handler;
      };
      this.waiter = handler;
      this.time.delayedCall(DUR, () => { if (this.waiter === handler) this.waiter = null; res(); });
    });
    this.qteActive = false;
    shrink.stop();
    const r = pressedAt < 0 ? -999 : R0 * (1 - (pressedAt - t0) / DUR);
    const diff = Math.abs(r - TARGET);
    const [mult, label, color] = diff <= 7 ? [1.3, "HOÀN HẢO!", 0x80ff90] : diff <= 18 ? [1.15, "TỐT!", 0xffe060] : [1, pressedAt < 0 ? "BỎ LỠ" : "LỆCH NHỊP", 0xb0b8c8];
    if (mult > 1) {
      const burst = this.add.circle(c.x, c.y, TARGET, color, 0.35).setDepth(60);
      this.tween({ targets: burst, scale: 2.4, alpha: 0, duration: 300 }).then(() => burst.destroy());
    }
    void this.popText({ x: c.x, y: c.y - 50 }, label, color, mult >= 1.3 ? 32 : 26);
    await this.tween({ targets: [target, zoneRing, ring, hint], alpha: 0, duration: 160 });
    [target, zoneRing, ring, hint].forEach((o) => o.destroy());
    this.msg.setText("");
    return mult;
  }

  /* ------------------------------------------------------------ */
  /* Bond (capture)                                               */
  /* ------------------------------------------------------------ */

  private async bondMenu(): Promise<PlayerAction | null> {
    const bag = this.data_.setup.bag;
    const owned = CRYSTALS.filter((id) => bag.count(id) > 0);
    if (!owned.length) { await this.say("Bạn không còn Pha Lê Kết Nối! Mua thêm ở quầy của cô Hạnh."); return null; }
    this.clearUi();
    this.overlay(0x203048, 0.96);
    this.panel(96, 30, 448, 60 + owned.length * 40);
    this.ui.add(this.text(118, 40, "KẾT NỐI · Chọn pha lê", 28));
    const buttons = owned.map((id, i) => {
      const pct = Math.round(this.engine.bondOdds(id) * 100);
      return this.listButton(110, 80 + i * 40, 420, 36, i, getItem(id)!.name, `×${bag.count(id)} · ${pct}%`);
    });
    this.panel(16, 296, 456, 88);
    this.ui.add(this.text(36, 306, "Tỉ lệ hiện tại. Giữ đúng 3 nhịp đồng điệu để tăng thêm tới +75% sức kết nối!", 22).setWordWrapWidth(420));
    this.backButton(480, 322);
    const r = await this.choose(buttons, 1, 0);
    this.clearUi();
    if (r === null) return null;
    const id = owned[r];
    let bonus = 1;
    for (let i = 0; i < 3; i++) {
      const m = await this.timingCheck();
      bonus += m >= 1.3 ? 0.25 : m >= 1.15 ? 0.12 : 0;
    }
    await this.say(`Độ đồng điệu ×${bonus.toFixed(2)} · Tỉ lệ kết nối ${Math.round(this.engine.bondOdds(id, bonus) * 100)}%`, 1100);
    return { type: "bond", itemId: id, bonus };
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
    } else {
      box.caught = this.add.text(16, 40, "● ĐÃ BẮT", { fontFamily: UI_FONT, fontSize: "17px", color: "#e04848" }).setResolution(2).setVisible(false);
      root.add(box.caught);
    }
    return box;
  }

  private setView(box: InfoBox, v: MonView) {
    box.view = { ...v };
    box.name.setText(v.name.toUpperCase());
    box.level.setText(`Lv${v.level}`);
    this.drawHp(box, v.hp, v.maxHp);
    this.setStatus(box, v.status);
    if (box.caught) box.caught.setVisible(!v.status && Boolean(this.data_.setup.hasCaught?.(v.speciesId)));
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
    this.setMark(side, null, 0);

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
    this.shadows[side].setVisible(true).setScale(0.2);
    this.tween({ targets: this.shadows[side], scale: 1, duration: 220 });
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
    this.shadows.player.setVisible(false);
    await this.tween({ targets: this.playerBox.root, alpha: 0, duration: 150 });
  }

  /** Bond crystal: a faceted floating gem (replaces thrown capture devices). */
  private drawBall(ballId: string) {
    const [core, glow] = CRYSTAL_COLORS[ballId] ?? CRYSTAL_COLORS["poke-ball"];
    const g = this.add.graphics();
    g.fillStyle(glow, 0.35).fillCircle(0, 0, 13);
    g.fillStyle(core, 1).fillPoints([new Phaser.Math.Vector2(0, -13), new Phaser.Math.Vector2(8, -2), new Phaser.Math.Vector2(0, 13), new Phaser.Math.Vector2(-8, -2)], true);
    g.fillStyle(glow, 1).fillPoints([new Phaser.Math.Vector2(0, -13), new Phaser.Math.Vector2(-8, -2), new Phaser.Math.Vector2(0, 2)], true);
    g.fillStyle(0xffffff, 0.9).fillPoints([new Phaser.Math.Vector2(0, -13), new Phaser.Math.Vector2(3, -4), new Phaser.Math.Vector2(0, -1)], true);
    g.lineStyle(1.5, 0x102030, 0.8).strokePoints([new Phaser.Math.Vector2(0, -13), new Phaser.Math.Vector2(8, -2), new Phaser.Math.Vector2(0, 13), new Phaser.Math.Vector2(-8, -2)], true);
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
    const big = move.power >= 60 || move.id.startsWith("ult-");
    if (big) this.tweens.add({ targets: this.hudGroup, alpha: 0.12, duration: 180 });
    try { await this.fx.play(move, side, user, target); }
    finally { if (big) this.tweens.add({ targets: this.hudGroup, alpha: 1, duration: 220 }); }
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
    this.shadows[side].setVisible(false);
    this.setMark(side, null, 0);
    await this.tween({ targets: box.root, alpha: 0, duration: 150 });
  }

  private async catchAnim(ballId: string, shakes: number, caught: boolean) {
    this.stopIdle("foe");
    const ADD = Phaser.BlendModes.ADD;
    const [core] = CRYSTAL_COLORS[ballId] ?? CRYSTAL_COLORS["poke-ball"];
    const home = { x: FOE.x, y: FOE.y - 70 };
    const gem = this.add.container(PLAYER.x + 40, PLAYER.y - 120, [this.drawBall(ballId)]).setDepth(35).setScale(1.4);
    // Float up from the trainer, then glide over the foe.
    await this.tween({ targets: gem, x: home.x, y: home.y - 40, duration: 620, ease: "Sine.easeInOut" });
    // Light tether + the foe dissolving into the crystal.
    const tether = this.add.graphics().setDepth(34).setBlendMode(ADD);
    tether.lineStyle(10, core, 0.35).lineBetween(gem.x, gem.y, home.x, home.y + 30).lineStyle(3, 0xffffff, 1).lineBetween(gem.x, gem.y, home.x, home.y + 30);
    this.foeSprite.setTintFill(core);
    await this.tween({ targets: this.foeSprite, scale: 0, alpha: 0.4, duration: 380, ease: "Cubic.easeIn" });
    tether.destroy();
    this.shadows.foe.setVisible(false);
    await this.tween({ targets: gem, y: FOE.y - 26, duration: 300, ease: "Bounce.easeOut" });
    // Each successful check = one pulse of light.
    for (let i = 0; i < shakes; i++) {
      await this.wait(260);
      const ring = this.add.image(gem.x, gem.y, "vfx-ring").setTint(core).setBlendMode(ADD).setDepth(36).setScale(0.1, 0.04);
      this.tween({ targets: ring, scaleX: 0.9, scaleY: 0.3, alpha: 0, duration: 420 }).then(() => ring.destroy());
      await this.tween({ targets: gem, scale: 1.7, duration: 110, yoyo: true });
    }
    await this.wait(320);
    if (caught) {
      for (let i = 0; i < 10; i++) {
        const star = this.particle("fx-star", gem.x, gem.y - 6, i % 2 ? core : 0xffffff, 36).setScale(0.3);
        const a = (i / 10) * Math.PI * 2;
        this.tweens.add({ targets: star, x: gem.x + Math.cos(a) * 60, y: gem.y + Math.sin(a) * 30 - 20, alpha: 0, duration: 650, onComplete: () => star.destroy() });
      }
      this.cameras.main.flash(200, 255, 255, 255, true);
      await this.tween({ targets: gem, y: gem.y - 30, scale: 2, alpha: 0, duration: 700 });
      gem.destroy();
    } else {
      for (let i = 0; i < 8; i++) {
        const shard = this.particle("fx-shard", gem.x, gem.y, core, 36);
        this.tweens.add({ targets: shard, x: gem.x + Phaser.Math.Between(-60, 60), y: gem.y + Phaser.Math.Between(-50, 20), angle: 360, alpha: 0, duration: 420, onComplete: () => shard.destroy() });
      }
      gem.destroy();
      this.foeSprite.setPosition(FOE.x, FOE.y).setAlpha(1);
      this.shadows.foe.setVisible(true);
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
    this.msg.setWordWrapWidth(190).setText(`${displayName(this.engine.playerMon)} sẽ làm gì?`);
    const ready = this.engine.surgeReady("player");
    const defs: [string, number, boolean][] = [
      ["ĐÁNH", 0xe05050, true], ["THỦ", 0x3898c8, true], [ready ? "TUYỆT KỸ" : `BP ${Math.floor(this.engine.surge("player"))}%`, ready ? 0xf0a020 : 0x6a6050, true], ["TÚI", 0xe8a030, true],
      ["ĐỔI", 0x48a848, true], ["KẾT NỐI", 0x9060d8, !this.engine.isTrainer], ["CHẠY", 0x4878d8, !this.engine.isTrainer],
    ];
    const bw = 94, bh = 44;
    const buttons = defs.map(([label, col, enabled], i) => {
      const x = 236 + (i % 4) * (bw + 4), y = PANEL_Y + 12 + Math.floor(i / 4) * (bh + 8);
      const t = this.text(bw / 2, bh / 2 - 1, label, label.length > 6 ? 21 : 26, "#ffffff", true).setOrigin(0.5);
      const b = this.button(x, y, bw, bh, i, (g, f) => {
        g.fillStyle(darken(col, 30), 1).fillRoundedRect(0, 2, bw, bh, 10);
        g.fillStyle(f ? lighten(col, 12) : col, 1).fillRoundedRect(0, 0, bw, bh - 2, 10);
        g.fillStyle(0xffffff, 0.22).fillRoundedRect(4, 3, bw - 8, 12, 6);
        if (f) g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(1, 1, bw - 2, bh - 4, 9);
      }, [t]);
      if (!enabled) b.root.setAlpha(0.45);
      if (i === 2 && ready) this.tweens.add({ targets: b.root, alpha: 0.7, duration: 360, yoyo: true, repeat: -1 });
      return b;
    });
    const r = await this.choose(buttons, 4, this.lastAction, false);
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
    const foeTypes = getSpecies(this.engine.foeMon.speciesId).types;
    const effTag = (eff: number) => (eff >= 4 ? "4×" : eff >= 2 ? "2×" : eff === 0 ? "0×" : eff <= 0.25 ? "¼×" : eff < 1 ? "½×" : "");
    const buttons = mon.moves.map((m, i) => {
      const d = getMove(m.id), col = hex(TYPE_COLORS[d.type] ?? "#a8a878");
      const eff = d.power ? effectiveness(d.type, foeTypes) : 1;
      const badgeText = effTag(eff);
      const x = 10 + (i % 2) * (bw + 6), y = PANEL_Y + 8 + Math.floor(i / 2) * (bh + 6);
      const name = this.text(12, 3, d.name, 23, "#ffffff", true);
      const el = elementOf(d), cost = energyCost(d), affordable = cost <= this.engine.energy("player");
      const reaction = d.power ? this.engine.previewReaction(d.id) : null;
      const detail = this.text(12, 25, reaction ? `→ ${reaction.name} ×${reaction.mult}` : `${el ? ELEMENT_INFO[el].name.toUpperCase() : TYPE_VI[d.type]} · ${d.power ? `${d.power} POW` : "TRẠNG THÁI"}`, 15, reaction ? "#fff36a" : "#fff0b8", true);
      const pp = this.text(bw - 10, 25, cost ? `NL ${cost}` : "MIỄN PHÍ", 16, affordable ? "#bff4ff" : "#ffb0b0", true).setOrigin(1, 0);
      const kids: Phaser.GameObjects.GameObject[] = [name, detail, pp];
      if (badgeText) {
        const bCol = eff > 1 ? "#ffe066" : eff === 0 ? "#b8b8c0" : "#ffb0a0";
        kids.push(this.text(bw - 10, 3, badgeText, 18, bCol, true).setOrigin(1, 0));
      }
      const b = this.button(x, y, bw, bh, i, (gr, f) => {
        gr.fillStyle(darken(col, 35), 1).fillRoundedRect(0, 2, bw, bh, 9);
        gr.fillStyle(f ? lighten(col, 8) : darken(col, 8), 1).fillRoundedRect(0, 0, bw, bh - 2, 9);
        gr.fillStyle(0xffffff, 0.2).fillRoundedRect(4, 3, bw - 8, 10, 5);
        if (f) gr.lineStyle(3, 0xffffff, 1).strokeRoundedRect(1, 1, bw - 2, bh - 4, 8);
      }, kids);
      b.enabled = affordable;
      if (!b.enabled) b.root.setAlpha(0.5);
      if (reaction && affordable) this.tweens.add({ targets: detail, alpha: 0.55, duration: 380, yoyo: true, repeat: -1 });
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
      const eff = d.power ? effectiveness(d.type, foeTypes) : 1;
      const effDesc = eff > 1 ? " · RẤT HIỆU QUẢ!" : eff === 0 ? " · VÔ HIỆU" : eff < 1 ? " · KÉM HIỆU QUẢ" : "";
      typeChip.setText(TYPE_VI[d.type].toUpperCase()).setBackgroundColor(TYPE_COLORS[d.type] ?? "#a8a878");
      cat.setText((d.power ? (categoryOf(d.type) === "physical" ? "Vật lý" : "Đặc biệt") : "Trạng thái") + effDesc);
      const cost = energyCost(d);
      pow.setText(`${d.power ? `${d.power} · ${d.accuracy ?? "—"}%` : d.accuracy ? `Chính xác ${d.accuracy}%` : "Luôn trúng"} · NL ${cost}`);
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
    const owned = Object.keys(ITEMS).filter((id) => bag.count(id) > 0 && ITEMS[id].category !== "evolution" && ITEMS[id].category !== "ball");
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
