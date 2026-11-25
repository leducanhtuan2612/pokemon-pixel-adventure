import Phaser from "phaser";

/**
 * Pseudo-3D effect toolkit for battle moves. Everything is still 2D sprites,
 * but depth is faked with the tricks anime and 2.5D games use:
 *  - particles that orbit an axis swap draw order (in front of / behind the
 *    target) and scale with their virtual Z, so they visibly wrap around it;
 *  - rings are squashed perpendicular to the beam axis or flattened onto the
 *    floor plane, so they read as discs in space;
 *  - beams are cones (narrow at the mouth, wide at impact) with a scrolling
 *    energy texture, which reads as volume and motion toward the camera;
 *  - the camera zooms, pans, punches and blooms like a cinematic shot.
 */

export type Pt = { x: number; y: number };
type Img = Phaser.GameObjects.Image;
const ADD = Phaser.BlendModes.ADD;
const rnd = Phaser.Math.FloatBetween;
const lerp = Phaser.Math.Linear;

/** Depth just above the dim overlay but below battle sprites: "behind the target". */
export const BEHIND = 4.6;

export interface Fx3DHooks {
  /** Adds a screen-space object (not affected by camera zoom), e.g. letterbox or title card. */
  uiAdd(obj: Phaser.GameObjects.GameObject): void;
  /** Shows/hides the battle HUD during cinematics. */
  setHud(visible: boolean): void;
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  scene.textures.addCanvas(key, cv);
}

export function ensure3DTextures(scene: Phaser.Scene) {
  // Tileable energy streaks, scrolled along beams.
  canvasTex(scene, "fx3-noise", 256, 64, (c) => {
    for (let i = 0; i < 70; i++) {
      const y = Math.random() * 64, len = 30 + Math.random() * 140, x = Math.random() * 256, a = 0.15 + Math.random() * 0.75, h = 1 + Math.random() * 4;
      const g = c.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(x, y, len, h);
      if (x + len > 256) c.fillRect(x - 256, y, len, h); // wrap so the tile scrolls seamlessly
    }
  });
  // Faceted ice prism with light/dark faces so it reads as a 3D crystal.
  canvasTex(scene, "fx3-shard", 28, 64, (c) => {
    c.fillStyle = "rgba(170,230,255,0.95)"; c.beginPath(); c.moveTo(14, 0); c.lineTo(26, 18); c.lineTo(22, 64); c.lineTo(14, 64); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,0.98)"; c.beginPath(); c.moveTo(14, 0); c.lineTo(2, 18); c.lineTo(6, 64); c.lineTo(14, 64); c.closePath(); c.fill();
    c.fillStyle = "rgba(110,190,240,0.9)"; c.beginPath(); c.moveTo(14, 0); c.lineTo(17, 22); c.lineTo(16, 64); c.lineTo(14, 64); c.closePath(); c.fill();
  });
  // Faceted boulder with top light and dark underside.
  canvasTex(scene, "fx3-rock", 40, 34, (c) => {
    c.fillStyle = "#3e342c"; c.beginPath(); c.moveTo(8, 4); c.lineTo(32, 2); c.lineTo(40, 18); c.lineTo(28, 34); c.lineTo(6, 32); c.lineTo(0, 16); c.closePath(); c.fill();
    c.fillStyle = "#8a7a64"; c.beginPath(); c.moveTo(8, 4); c.lineTo(32, 2); c.lineTo(34, 14); c.lineTo(12, 16); c.lineTo(0, 16); c.closePath(); c.fill();
    c.fillStyle = "#c8b898"; c.beginPath(); c.moveTo(10, 5); c.lineTo(26, 4); c.lineTo(22, 10); c.lineTo(10, 11); c.closePath(); c.fill();
  });
  // Soft puff used for smoke / steam / flame bodies.
  canvasTex(scene, "fx3-puff", 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.45, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
}

/** Colour ramp for fire particles over their life: white-hot → yellow → orange → deep red. */
const FIRE_RAMP = [0xffffff, 0xfff2a0, 0xffb040, 0xff6420, 0xc02810];
function ramp(colors: number[], t: number) {
  const f = Math.max(0, Math.min(0.9999, t)) * (colors.length - 1), i = Math.floor(f);
  const a = Phaser.Display.Color.IntegerToColor(colors[i]), b = Phaser.Display.Color.IntegerToColor(colors[i + 1]);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, (f - i) * 100);
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

export class Fx3D {
  private bloomFx?: Phaser.FX.Bloom;
  private barrelFx?: Phaser.FX.Barrel;

  constructor(private scene: Phaser.Scene, private hooks: Fx3DHooks, private depth = 34) {
    ensure3DTextures(scene);
  }

  /* ---------------- timing helpers ---------------- */

  wait(ms: number) { return new Promise<void>((r) => this.scene.time.delayedCall(ms, () => r())); }
  tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) { return new Promise<void>((r) => this.scene.tweens.add({ ...cfg, onComplete: () => r() })); }
  /** Runs `fn(t)` every frame for `ms`, t going 0 → 1. */
  animate(ms: number, fn: (t: number) => void, ease = "Linear") {
    const o = { t: 0 };
    return this.tween({ targets: o, t: 1, duration: ms, ease, onUpdate: () => fn(o.t) });
  }
  private img(x: number, y: number, key: string, color: number, depth = this.depth) {
    return this.scene.add.image(x, y, key).setTint(color).setBlendMode(ADD).setDepth(depth);
  }

  /* ---------------- camera ---------------- */

  private get cam() { return this.scene.cameras.main; }
  private get webgl() { return this.scene.game.renderer.type === Phaser.WEBGL; }

  async focus(p: Pt, zoom = 1.3, ms = 320) {
    this.cam.pan(p.x, p.y, ms, "Cubic.easeOut", true);
    this.cam.zoomTo(zoom, ms, "Cubic.easeOut", true);
    await this.wait(ms);
  }
  async resetCam(ms = 320) {
    this.cam.pan(320, 200, ms, "Cubic.easeInOut", true);
    this.cam.zoomTo(1, ms, "Cubic.easeInOut", true);
    await this.wait(ms);
  }
  /** Hit-stop style zoom punch with shake. */
  punch(strength = 1) {
    const z = this.cam.zoom;
    this.cam.zoomTo(z * (1 + 0.08 * strength), 60, "Quad.easeOut", true, (_c, p) => {
      if (p === 1) this.cam.zoomTo(z, 220, "Quad.easeOut", true);
    });
    this.cam.shake(240 + 80 * strength, 0.008 * strength);
  }
  flash(ms = 140, r = 255, g = 255, b = 255) { this.cam.flash(ms, r, g, b, true); }

  bloom(on: boolean, strength = 1.3) {
    if (!this.webgl) return;
    if (on && !this.bloomFx) this.bloomFx = this.cam.postFX.addBloom(0xffffff, 1, 1, 1.1, strength, 4);
    if (!on && this.bloomFx) { this.cam.postFX.remove(this.bloomFx); this.bloomFx = undefined; }
  }
  /** Space-warp lens distortion (for mystic/time-space ultimates). */
  async warp(amount = 1.12, ms = 600) {
    if (!this.webgl) return;
    this.barrelFx = this.cam.postFX.addBarrel(1);
    await this.tween({ targets: this.barrelFx, amount, duration: ms / 2, yoyo: true, ease: "Sine.easeInOut" });
    this.cam.postFX.remove(this.barrelFx);
    this.barrelFx = undefined;
  }

  /** Cinematic black bars that slide in from top/bottom (screen space). */
  async letterbox(on: boolean) {
    if (on) {
      const top = this.scene.add.rectangle(320, -30, 640, 60, 0x000000).setDepth(500);
      const bot = this.scene.add.rectangle(320, 430, 640, 60, 0x000000).setDepth(500);
      this.hooks.uiAdd(top); this.hooks.uiAdd(bot);
      this.bars = [top, bot];
      this.hooks.setHud(false);
      await Promise.all([this.tween({ targets: top, y: 26, duration: 220 }), this.tween({ targets: bot, y: 374, duration: 220 })]);
    } else if (this.bars) {
      const [top, bot] = this.bars;
      this.bars = undefined;
      await Promise.all([this.tween({ targets: top, y: -30, duration: 220 }), this.tween({ targets: bot, y: 430, duration: 220 })]);
      top.destroy(); bot.destroy();
      this.hooks.setHud(true);
    }
  }
  private bars?: Phaser.GameObjects.Rectangle[];

  /** Extruded 3D title card for ultimates (screen space). */
  async titleCard(name: string, color: number, sub = "TUYỆT KỸ") {
    const css = "#" + color.toString(16).padStart(6, "0");
    const box = this.scene.add.container(320, 200).setDepth(510);
    this.hooks.uiAdd(box);
    const style = (fill: string, stroke?: string): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: "VT323, monospace", fontSize: "54px", color: fill, ...(stroke ? { stroke, strokeThickness: 6 } : {}),
    });
    // Extrusion: stacked copies stepping down-right, darkening with depth.
    const layers: Phaser.GameObjects.Text[] = [];
    for (let i = 7; i >= 1; i--) {
      const shade = Phaser.Display.Color.IntegerToColor(color).darken(30 + i * 6).color;
      layers.push(this.scene.add.text(i * 1.5, i * 1.5, name.toUpperCase(), style("#" + shade.toString(16).padStart(6, "0"))).setOrigin(0.5).setResolution(2));
    }
    const face = this.scene.add.text(0, 0, name.toUpperCase(), style("#ffffff", css)).setOrigin(0.5).setResolution(2);
    const tag = this.scene.add.text(0, -44, `— ${sub} —`, { fontFamily: "VT323, monospace", fontSize: "24px", color: css, stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setResolution(2);
    const streak = this.scene.add.rectangle(0, 6, 660, 58, color, 0.28).setBlendMode(ADD);
    box.add([streak, ...layers, face, tag]);
    box.setScale(2.6).setAlpha(0);
    await this.tween({ targets: box, scale: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
    this.flash(120);
    await this.tween({ targets: box, scale: 1.06, duration: 520, ease: "Sine.easeOut" });
    await this.tween({ targets: box, scaleX: 2.2, scaleY: 0.1, alpha: 0, duration: 200, ease: "Cubic.easeIn" });
    box.destroy();
  }

  /* ---------------- primitives ---------------- */

  /** Anime focus lines radiating from a point; returns a stop function. */
  radialLines(c: Pt, color = 0xffffff, alpha = 0.55) {
    const g = this.scene.add.graphics().setDepth(4.4).setBlendMode(ADD);
    const ev = this.scene.time.addEvent({ delay: 45, loop: true, callback: () => {
      g.clear();
      for (let i = 0; i < 44; i++) {
        const a = Math.random() * Math.PI * 2, r0 = 60 + Math.random() * 90, r1 = 700, w = 0.01 + Math.random() * 0.025;
        g.fillStyle(i % 3 ? color : 0xffffff, alpha * (0.3 + Math.random() * 0.7));
        g.fillTriangle(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, c.x + Math.cos(a - w) * r1, c.y + Math.sin(a - w) * r1, c.x + Math.cos(a + w) * r1, c.y + Math.sin(a + w) * r1);
      }
    } });
    return async () => { ev.remove(); await this.tween({ targets: g, alpha: 0, duration: 160 }); g.destroy(); };
  }

  /** A disc of light perpendicular to `angle` (the travel axis), spinning in 3D. */
  perspRing(p: Pt, angle: number, color: number, size = 1, ms = 520, travelTo?: Pt) {
    const r = this.img(p.x, p.y, "vfx-ring", color).setRotation(angle).setScale(0.12 * size, 0.4 * size).setAlpha(0.95);
    const spin = { a: 0 };
    return this.tween({
      targets: spin, a: 1, duration: ms, ease: "Quad.easeOut",
      onUpdate: () => {
        const grow = 1 + spin.a * 1.6;
        // scaleX wobbles like a disc rotating around the axis.
        r.setScale((0.14 + 0.06 * Math.sin(spin.a * Math.PI * 3)) * size * grow, 0.42 * size * grow).setAlpha(0.95 * (1 - spin.a));
        if (travelTo) r.setPosition(lerp(p.x, travelTo.x, spin.a), lerp(p.y, travelTo.y, spin.a));
      },
    }).then(() => r.destroy());
  }

  /** Disc flattened onto the floor plane, expanding outward (shockwave). */
  async groundWave(p: Pt, color: number, size = 1, ms = 520) {
    const ring = this.img(p.x, p.y, "vfx-ring", color, 4.8).setScale(0.2 * size, 0.06 * size);
    const ring2 = this.img(p.x, p.y, "vfx-ring", 0xffffff, 4.8).setScale(0.1 * size, 0.03 * size);
    const dust = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      const d = this.scene.add.image(p.x, p.y, "fx3-puff").setTint(color).setAlpha(0.5).setDepth(i < 5 ? BEHIND : this.depth).setScale(0.3);
      return this.tween({ targets: d, x: p.x + Math.cos(a) * 120 * size, y: p.y + Math.sin(a) * 30 * size, scale: 1.1, alpha: 0, duration: ms + 200 }).then(() => d.destroy());
    });
    await Promise.all([
      this.tween({ targets: ring, scaleX: 2.6 * size, scaleY: 0.75 * size, alpha: 0, duration: ms, ease: "Cubic.easeOut" }),
      this.tween({ targets: ring2, scaleX: 1.8 * size, scaleY: 0.5 * size, alpha: 0, duration: ms * 0.8, ease: "Cubic.easeOut" }),
      ...dust,
    ]);
    ring.destroy(); ring2.destroy();
  }

  /** Particles spiralling along an axis, swapping in front of/behind it with virtual Z. */
  helix(from: Pt, to: Pt, color: number, ms = 700, strands = 2, count = 26, radius = 34, key = "vfx-core") {
    const ang = Math.atan2(to.y - from.y, to.x - from.x), nx = -Math.sin(ang), ny = Math.cos(ang);
    const jobs = Array.from({ length: strands * count }, (_, i) => {
      const s = i % strands, k = Math.floor(i / strands);
      return this.wait((k / count) * ms * 0.5).then(() => {
        const p = this.img(from.x, from.y, key, k % 4 === 0 ? 0xffffff : color).setAlpha(0);
        return this.animate(ms * 0.5, (t) => {
          const phase = t * Math.PI * 5 + (s / strands) * Math.PI * 2;
          const z = Math.sin(phase), r = radius * (0.5 + t * 0.8);
          const x = lerp(from.x, to.x, t) + nx * Math.cos(phase) * r, y = lerp(from.y, to.y, t) + ny * Math.cos(phase) * r * 0.6 - z * 6;
          p.setPosition(x, y).setScale((0.28 + z * 0.12) * (key === "vfx-core" ? 1 : 0.5)).setAlpha(t < 0.1 ? t * 10 : 1 - Math.max(0, t - 0.8) * 5);
          p.setDepth(z < 0 ? BEHIND : this.depth + 1);
        }).then(() => { p.destroy(); });
      });
    });
    return Promise.all(jobs).then(() => undefined);
  }

  /** Volumetric cone beam with scrolling energy, perpendicular rings and a helix. */
  async coneBeam(from: Pt, to: Pt, color: number, opts: { w0?: number; w1?: number; ms?: number; rings?: number; helix?: boolean; core?: number } = {}) {
    const { w0 = 16, w1 = 110, ms = 700, rings = 5, helix = true, core = 0xffffff } = opts;
    const ang = Math.atan2(to.y - from.y, to.x - from.x), len = Math.hypot(to.x - from.x, to.y - from.y);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const g = this.scene.add.graphics().setDepth(this.depth + 2).setBlendMode(ADD);
    const flow = this.scene.add.tileSprite((from.x + to.x) / 2, (from.y + to.y) / 2, len, w1 * 0.7, "fx3-noise")
      .setRotation(ang).setTint(color).setBlendMode(ADD).setDepth(this.depth + 3).setAlpha(0.9);
    const cone = (k: number, col: number, alpha: number, grow: number) => {
      const a = (w0 * k) / 2, b = (w1 * k * grow) / 2;
      g.fillStyle(col, alpha).fillPoints([
        new Phaser.Math.Vector2(from.x + nx * a, from.y + ny * a), new Phaser.Math.Vector2(to.x + nx * b, to.y + ny * b),
        new Phaser.Math.Vector2(to.x - nx * b, to.y - ny * b), new Phaser.Math.Vector2(from.x - nx * a, from.y - ny * a),
      ], true);
    };
    const mouth = this.img(from.x, from.y, "vfx-glow", color).setScale(0.9);
    const mouthCore = this.img(from.x, from.y, "vfx-glow", 0xffffff).setScale(0.45);
    const impact = this.img(to.x, to.y, "vfx-glow", color).setScale(1.2);
    const ringJobs: Promise<void>[] = [];
    const ringTimer = this.scene.time.addEvent({ delay: ms / Math.max(1, rings), repeat: rings - 1, callback: () => {
      ringJobs.push(this.perspRing(from, ang, color, 0.9, ms * 0.6, { x: lerp(from.x, to.x, 0.55), y: lerp(from.y, to.y, 0.55) }));
    } });
    const helixJob = helix ? this.helix(from, to, color, ms, 2, 18, w1 * 0.45) : Promise.resolve();
    await this.animate(ms, (t) => {
      const open = Math.min(1, t * 5), close = t > 0.8 ? 1 - (t - 0.8) * 5 : 1, flick = 0.92 + Math.random() * 0.16;
      const grow = open * close * flick;
      g.clear();
      cone(1.7, color, 0.22, grow);
      cone(1.1, color, 0.55, grow);
      cone(0.45, core, 0.95, grow);
      flow.tilePositionX -= 22;
      flow.setScale(1, Math.max(0.05, grow)).setAlpha(0.9 * close);
      mouth.setScale(0.9 * flick * close + 0.1); mouthCore.setScale(0.45 * flick * close + 0.05);
      impact.setScale(1.2 + Math.sin(t * 30) * 0.15).setAlpha(close);
    });
    ringTimer.remove();
    await Promise.all([...ringJobs, helixJob]);
    [g, flow, mouth, mouthCore, impact].forEach((o) => o.destroy());
  }

  /** Boulders/debris thrown in 3D arcs with ground shadows. */
  async debris(p: Pt, count = 10, color = 0xffffff, key = "fx3-rock", floorY = p.y + 40) {
    await Promise.all(Array.from({ length: count }, (_, i) => {
      const r = this.scene.add.image(p.x, p.y, key).setDepth(i % 2 ? BEHIND : this.depth + 1).setScale(rnd(0.35, 0.8)).setTint(color);
      const shadow = this.scene.add.ellipse(p.x, floorY, 18, 6, 0x000000, 0.35).setDepth(4.7);
      const vx = rnd(-170, 170), vz = rnd(-30, 30), up = rnd(90, 190), spin = rnd(-8, 8);
      return this.animate(rnd(560, 820), (t) => {
        const x = p.x + vx * t, ground = floorY + vz * t, h = up * 4 * t * (1 - t);
        r.setPosition(x, ground - h - 20 * (1 - t)).setRotation(spin * t).setAlpha(t > 0.85 ? (1 - t) * 6.6 : 1);
        shadow.setPosition(x, ground).setScale(1 - (h / up) * 0.5).setAlpha(0.35 * (1 - t * 0.6));
      }).then(() => { r.destroy(); shadow.destroy(); });
    }));
  }

  /** Flamethrower: a turbulent cone of puffs that ramp white → red and swell with distance. */
  async flameStream(from: Pt, to: Pt, ms = 900, scale = 1) {
    const ang = Math.atan2(to.y - from.y, to.x - from.x), nx = -Math.sin(ang), ny = Math.cos(ang);
    const heat = this.img(from.x, from.y, "vfx-glow", 0xff9a30).setScale(0.9 * scale);
    const jobs: Promise<void>[] = [];
    const spawn = this.scene.time.addEvent({ delay: 14, repeat: Math.floor(ms / 14), callback: () => {
      for (let k = 0; k < 2; k++) {
        const p = this.scene.add.image(from.x, from.y, k ? "vfx-flame" : "fx3-puff").setBlendMode(ADD).setDepth(this.depth + 1 + Math.random()).setRotation(ang + Math.PI / 2);
        const wob = rnd(-1, 1), life = rnd(360, 520), reach = rnd(0.85, 1.15);
        jobs.push(this.animate(life, (t) => {
          const d = t * reach, side = Math.sin(t * 9 + wob * 5) * 10 * t + wob * 26 * t;
          p.setPosition(lerp(from.x, to.x, d) + nx * side, lerp(from.y, to.y, d) + ny * side - t * 14);
          // Partial alpha keeps the orange/red body readable instead of additive white-out.
          p.setScale((0.25 + t * 1.5) * scale * (k ? 0.7 : 1)).setTint(ramp(FIRE_RAMP, Math.min(1, t * 1.25))).setAlpha((t > 0.7 ? (1 - t) * 3.3 : 1) * 0.62);
        }).then(() => p.destroy()));
      }
    } });
    await this.animate(ms, (t) => heat.setScale((0.9 + Math.sin(t * 40) * 0.12) * scale));
    spawn.remove();
    heat.destroy();
    await Promise.all(jobs);
  }

  /** Five-armed flame burst exploding outward on the target. */
  async fireStar(t: Pt, size = 1) {
    const core = this.img(t.x, t.y, "vfx-glow", 0xffffff).setScale(0.3);
    this.tween({ targets: core, scale: 2.4 * size, alpha: 0, duration: 700 }).then(() => core.destroy());
    const arms = Array.from({ length: 5 }, (_, i) => -Math.PI / 2 + (i / 5) * Math.PI * 2);
    const jobs = arms.flatMap((a) => Array.from({ length: 12 }, (_, k) => {
      const p = this.scene.add.image(t.x, t.y, "fx3-puff").setBlendMode(ADD).setDepth(this.depth + 2);
      const dist = (30 + k * 9) * size;
      return this.wait(k * 18).then(() => this.animate(520, (u) => {
        p.setPosition(t.x + Math.cos(a) * dist * u, t.y + Math.sin(a) * dist * u * 0.85).setScale((0.3 + u * 0.9) * size).setTint(ramp(FIRE_RAMP, u * 0.9 + k * 0.01)).setAlpha(1 - u);
      })).then(() => p.destroy());
    }));
    await Promise.all(jobs);
  }

  /** Orbs orbiting `c` on a tilted 3D ellipse, then returned for launching. */
  async orbit(c: Pt, n: number, color: number, ms = 800, rx = 70, ry = 22) {
    const orbs = Array.from({ length: n }, () => [this.img(c.x, c.y, "vfx-glow", color).setScale(0.45), this.img(c.x, c.y, "vfx-glow", 0xffffff).setScale(0.18)]);
    await this.animate(ms, (t) => orbs.forEach(([h, k], i) => {
      const a = t * Math.PI * 3 + (i / n) * Math.PI * 2, z = Math.sin(a), grow = Math.min(1, t * 3);
      const x = c.x + Math.cos(a) * rx * grow, y = c.y + z * ry * grow - 10;
      h.setPosition(x, y).setScale((0.45 + z * 0.12) * grow).setDepth(z < 0 ? BEHIND : this.depth + 1);
      k.setPosition(x, y).setScale((0.18 + z * 0.05) * grow).setDepth(z < 0 ? BEHIND : this.depth + 2);
    }));
    return orbs;
  }

  /** Curved homing beams from each orb to the target (Bezier arcs, thick glowing trails). */
  async homingBeams(orbs: Img[][], to: Pt, color: number, ms = 420) {
    await Promise.all(orbs.map(([h, k], i) => this.wait(i * 60).then(() => {
      const from = { x: h.x, y: h.y }, ctrl = { x: from.x + rnd(-60, 60), y: from.y - rnd(80, 150) };
      const trail = this.scene.add.graphics().setDepth(this.depth + 2).setBlendMode(ADD);
      const pts: Phaser.Math.Vector2[] = [];
      return this.animate(ms, (t) => {
        const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * ctrl.x + t * t * to.x;
        const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * ctrl.y + t * t * to.y;
        h.setPosition(x, y).setDepth(this.depth + 3); k.setPosition(x, y).setDepth(this.depth + 4);
        pts.push(new Phaser.Math.Vector2(x, y));
        if (pts.length > 14) pts.shift();
        trail.clear();
        if (pts.length > 1) {
          trail.lineStyle(22, color, 0.25).strokePoints(pts);
          trail.lineStyle(10, color, 0.7).strokePoints(pts);
          trail.lineStyle(3, 0xffffff, 1).strokePoints(pts);
        }
      }, "Sine.easeIn").then(() => { trail.destroy(); h.destroy(); k.destroy(); });
    })));
  }

  /** Ice crystals erupting from the floor in a ring around the target, then shattering. */
  async iceCrystals(t: Pt, count = 12, floorY = t.y + 44) {
    const shards = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + rnd(-0.2, 0.2), back = Math.sin(a) < 0;
      const x = t.x + Math.cos(a) * rnd(30, 62), y = floorY + Math.sin(a) * rnd(8, 16);
      const s = this.scene.add.image(x, y, "fx3-shard").setOrigin(0.5, 1).setDepth(back ? BEHIND : this.depth + 1)
        .setScale(rnd(0.7, 1.2) * (back ? 0.8 : 1), 0).setRotation(Math.cos(a) * 0.5);
      return s;
    });
    await Promise.all(shards.map((s, i) => this.wait(i * 22).then(() => this.tween({ targets: s, scaleY: s.scaleX * rnd(0.9, 1.5), duration: 160, ease: "Back.easeOut" }))));
    const frost = this.img(t.x, t.y, "vfx-glow", 0xaaf2ff).setScale(0.4);
    this.tween({ targets: frost, scale: 2, alpha: 0, duration: 520 }).then(() => frost.destroy());
    await this.wait(260);
    await Promise.all(shards.map((s) => {
      for (let k = 0; k < 3; k++) {
        const sp = this.img(s.x, s.y - 20, "vfx-spark", 0xdff8ff).setScale(0.7);
        this.tween({ targets: sp, x: sp.x + rnd(-40, 40), y: sp.y - rnd(10, 50), alpha: 0, scale: 0.1, duration: 420 }).then(() => sp.destroy());
      }
      return this.tween({ targets: s, alpha: 0, scaleY: 0, duration: 220 }).then(() => s.destroy());
    }));
  }

  /** Pillar of light/energy erupting from the floor through the target. */
  async pillar(t: Pt, color: number, floorY = t.y + 44, w = 70, ms = 520) {
    const g = this.scene.add.graphics().setDepth(this.depth + 1).setBlendMode(ADD);
    const base = this.img(t.x, floorY, "vfx-ring", color, 4.8).setScale(0.3, 0.09);
    this.tween({ targets: base, scaleX: 1.6, scaleY: 0.45, alpha: 0, duration: ms + 200 }).then(() => base.destroy());
    await this.animate(ms, (u) => {
      const h = Math.min(1, u * 3) * 360, ww = w * (u < 0.7 ? 1 : (1 - u) * 3.3) * (0.9 + Math.random() * 0.2);
      g.clear();
      g.fillStyle(color, 0.3).fillRect(t.x - ww, floorY - h, ww * 2, h);
      g.fillStyle(color, 0.65).fillRect(t.x - ww * 0.55, floorY - h, ww * 1.1, h);
      g.fillStyle(0xffffff, 0.95).fillRect(t.x - ww * 0.18, floorY - h, ww * 0.36, h);
    });
    g.destroy();
  }

  /** Ground-level magic sigil under a sprite, drawn in floor perspective. */
  sigil(p: Pt, color: number, size = 1) {
    // The image spins in its own plane; the parent container flattens it onto the floor,
    // so it reads as a disc rotating on the ground rather than a tilting ellipse.
    const img = this.scene.add.image(0, 0, "vfx-circle").setTint(color).setBlendMode(ADD).setAlpha(0.95);
    const c = this.scene.add.container(p.x, p.y, [img]).setDepth(4.8).setScale(0.1 * size, 0.03 * size);
    this.tween({ targets: c, scaleX: 0.9 * size, scaleY: 0.27 * size, duration: 320, ease: "Back.easeOut" });
    const spin = this.scene.tweens.add({ targets: img, angle: 360, duration: 2400, repeat: -1 });
    return async () => { spin.stop(); await this.tween({ targets: c, alpha: 0, scaleX: c.scaleX * 1.3, scaleY: c.scaleY * 1.3, duration: 240 }); c.destroy(); };
  }

  /** Converging energy motes toward a point (charge-up). */
  async charge(p: Pt, color: number, ms = 600, count = 30, radius = 130) {
    const core = this.img(p.x, p.y, "vfx-glow", color).setScale(0.2);
    const hot = this.img(p.x, p.y, "vfx-glow", 0xffffff).setScale(0.08);
    this.tween({ targets: core, scale: 1.1, duration: ms });
    this.tween({ targets: hot, scale: 0.5, duration: ms });
    await Promise.all(Array.from({ length: count }, (_, i) => {
      const a = rnd(0, Math.PI * 2), z = Math.sin(a);
      const m = this.img(p.x + Math.cos(a) * radius, p.y + z * radius * 0.45, "vfx-core", i % 3 ? color : 0xffffff, z < 0 ? BEHIND : this.depth + 1).setScale(0.25);
      return this.wait(rnd(0, ms * 0.5)).then(() => this.tween({ targets: m, x: p.x, y: p.y, scale: 0.05, duration: ms * 0.5, ease: "Cubic.easeIn" })).then(() => m.destroy());
    }));
    return [core, hot];
  }
}
