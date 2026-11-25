import Phaser from "phaser";
import type { MoveData } from "../../data/moves";
import { TYPE_COLORS, categoryOf } from "../../data/types";

type Pt = { x: number; y: number };
type Img = Phaser.GameObjects.Image;
const ADD = Phaser.BlendModes.ADD;
const rnd = Phaser.Math.Between;
const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;

/* ------------------------------------------------------------------ */
/* Soft glow textures (canvas gradients)                               */
/* ------------------------------------------------------------------ */

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  scene.textures.addCanvas(key, cv);
}

export function ensureFxTextures(scene: Phaser.Scene) {
  canvasTex(scene, "vfx-glow", 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,0.75)");
    g.addColorStop(0.6, "rgba(255,255,255,0.18)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
  canvasTex(scene, "vfx-core", 32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  });
  canvasTex(scene, "vfx-spark", 32, 32, (c) => {
    c.translate(16, 16);
    for (let i = 0; i < 2; i++) {
      const g = c.createLinearGradient(-16, 0, 16, 0);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(-16, -1.5, 32, 3);
      c.rotate(Math.PI / 2);
    }
    c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
  });
  canvasTex(scene, "vfx-streak", 128, 12, (c) => {
    const g = c.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.8, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.beginPath(); c.ellipse(64, 6, 64, 4, 0, 0, Math.PI * 2); c.fill();
  });
  canvasTex(scene, "vfx-ring", 160, 160, (c) => {
    const g = c.createRadialGradient(80, 80, 50, 80, 80, 78);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.55, "rgba(255,255,255,0.95)"); g.addColorStop(0.7, "rgba(255,255,255,0.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 160, 160);
  });
  canvasTex(scene, "vfx-crescent", 140, 140, (c) => {
    c.translate(70, 70);
    for (let i = 0; i < 18; i++) {
      const t = i / 17, a0 = -Math.PI * 0.9 + t * Math.PI * 1.0;
      c.strokeStyle = `rgba(255,255,255,${0.15 + t * 0.85})`;
      c.lineWidth = 2 + Math.sin(t * Math.PI) * 10;
      c.beginPath(); c.arc(0, 0, 54, a0, a0 + Math.PI / 17 + 0.02); c.stroke();
    }
  });
  canvasTex(scene, "vfx-flame", 40, 56, (c) => {
    const g = c.createRadialGradient(20, 38, 2, 20, 34, 26);
    g.addColorStop(0, "rgba(255,255,230,1)"); g.addColorStop(0.35, "rgba(255,220,120,0.95)"); g.addColorStop(0.7, "rgba(255,140,40,0.7)"); g.addColorStop(1, "rgba(220,60,20,0)");
    c.fillStyle = g;
    c.beginPath(); c.moveTo(20, 0); c.bezierCurveTo(34, 18, 40, 30, 36, 42); c.bezierCurveTo(32, 54, 8, 54, 4, 42); c.bezierCurveTo(0, 30, 6, 18, 20, 0); c.fill();
  });
  canvasTex(scene, "vfx-leaf", 26, 14, (c) => {
    c.fillStyle = "#58c048"; c.beginPath(); c.ellipse(13, 7, 12, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#a8f080"; c.beginPath(); c.ellipse(10, 5, 7, 3, -0.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#2c7030"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(2, 7); c.lineTo(24, 7); c.stroke();
  });
  canvasTex(scene, "vfx-needle", 40, 8, (c) => {
    const g = c.createLinearGradient(0, 0, 40, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.7, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,1)");
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 3); c.lineTo(34, 2); c.lineTo(40, 4); c.lineTo(34, 6); c.lineTo(0, 5); c.fill();
  });
  canvasTex(scene, "vfx-bubble", 32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 8, 16, 16, 15);
    g.addColorStop(0, "rgba(255,255,255,0.08)"); g.addColorStop(0.8, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0.9)");
    c.fillStyle = g; c.beginPath(); c.arc(16, 16, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.95)"; c.beginPath(); c.ellipse(11, 10, 4, 2.5, -0.6, 0, Math.PI * 2); c.fill();
  });
  canvasTex(scene, "vfx-rock", 30, 26, (c) => {
    c.fillStyle = "#4a4038"; c.beginPath(); c.moveTo(6, 1); c.lineTo(24, 3); c.lineTo(29, 17); c.lineTo(15, 25); c.lineTo(1, 16); c.closePath(); c.fill();
    c.fillStyle = "#8a7e6c"; c.beginPath(); c.moveTo(8, 4); c.lineTo(22, 6); c.lineTo(25, 15); c.lineTo(15, 21); c.lineTo(5, 15); c.closePath(); c.fill();
    c.fillStyle = "#c4b8a0"; c.fillRect(9, 6, 7, 4);
  });
  canvasTex(scene, "vfx-circle", 200, 200, (c) => {
    c.translate(100, 100);
    c.strokeStyle = "rgba(255,255,255,0.95)";
    c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 94, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 84, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 6; i++) { // hexagram
      const a = (i / 6) * Math.PI * 2, b = ((i + 2) / 6) * Math.PI * 2;
      c.beginPath(); c.moveTo(Math.cos(a) * 84, Math.sin(a) * 84); c.lineTo(Math.cos(b) * 84, Math.sin(b) * 84); c.stroke();
    }
    c.fillStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i < 16; i++) { // rune ticks
      const a = (i / 16) * Math.PI * 2;
      c.save(); c.rotate(a); c.fillRect(86, -1.5, 6, 3); c.restore();
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      c.save(); c.translate(Math.cos(a) * 89, Math.sin(a) * 89); c.rotate(a);
      c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 0); c.lineTo(0, 6); c.lineTo(-4, 0); c.closePath(); c.fill(); c.restore();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Effect player                                                       */
/* ------------------------------------------------------------------ */

const DEPTH = 34;

/**
 * Anime-style move effects built from additive glows: bright white cores with
 * type-coloured halos, rings, crescents, beams and particles. Every move used
 * by map-1 Pokémon has a signature effect; others fall back to their type.
 */
export class MoveFx {
  private dim: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {
    ensureFxTextures(scene);
    this.dim = scene.add.rectangle(320, 144, 640, 288, 0x0a0618, 0).setDepth(4);
  }

  /** Plays the effect for `move`; `user`/`target` are the battle sprites. */
  async play(move: MoveData, side: "player" | "foe", user: Img, target: Img) {
    const col = hex(TYPE_COLORS[move.type] ?? "#a8a878");
    const u = this.center(user), t = this.center(target), dir = side === "player" ? 1 : -1;
    const damaging = move.power > 0 || move.fixedDamage !== undefined || !!move.ohko;
    const ctx = { move, col, u, t, user, target, dir };
    // Darken the stage so additive light pops, like an anime move cut-in.
    await this.dimBg(true, damaging ? (move.power >= 70 ? 0.6 : 0.48) : 0.32);
    this.master = true;
    try {
      const sig = this.signatures[move.id];
      if (sig) await sig.call(this, ctx);
      else if (!damaging) await this.statusGeneric(ctx);
      else await this.typeGeneric(ctx);
      if (damaging) await this.cinematicImpact(target, t, col, Math.max(0.85, Math.min(1.65, move.power / 75)));
    } finally {
      this.master = false;
      await this.dimBg(false);
    }
  }

  /* ---------------- building blocks ---------------- */

  private center(s: Img): Pt { return { x: s.x, y: s.y - s.displayHeight * 0.45 }; }
  private wait(ms: number) { return new Promise<void>((r) => this.scene.time.delayedCall(ms, () => r())); }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) { return new Promise<void>((r) => this.scene.tweens.add({ ...cfg, onComplete: () => r() })); }

  private glow(x: number, y: number, color: number, scale = 1, alpha = 1, key = "vfx-glow") {
    return this.scene.add.image(x, y, key).setTint(color).setBlendMode(ADD).setScale(scale).setAlpha(alpha).setDepth(DEPTH);
  }

  /** Bright orb: coloured halo + white core. Returns both so they can travel together. */
  private orb(x: number, y: number, color: number, size = 1) {
    const tint = this.scene.add.image(x, y, "vfx-glow").setTint(color).setScale(0.6 * size).setAlpha(0.75).setDepth(DEPTH - 1);
    const halo = this.glow(x, y, color, 0.75 * size, 1);
    const core = this.glow(x, y, 0xffffff, 0.24 * size, 1);
    return [tint, halo, core];
  }

  private master = false;
  private async dimBg(on: boolean, alpha = 0.45) {
    if (this.master) return;
    await this.tween({ targets: this.dim, fillAlpha: on ? alpha : 0, duration: on ? 160 : 260 });
  }

  /** Expanding shockwave ring + flash + sparks at a point. */
  private async burst(p: Pt, color: number, size = 1, sparks = 10) {
    const tintHalo = this.scene.add.image(p.x, p.y, "vfx-glow").setTint(color).setScale(0.5 * size).setAlpha(0.7).setDepth(DEPTH - 1);
    this.scene.tweens.add({ targets: tintHalo, scale: 1.3 * size, alpha: 0, duration: 420, onComplete: () => tintHalo.destroy() });
    const flash = this.glow(p.x, p.y, 0xffffff, 0.3 * size);
    const halo = this.glow(p.x, p.y, color, 0.5 * size, 0.9);
    const ring = this.scene.add.image(p.x, p.y, "vfx-ring").setTint(color).setBlendMode(ADD).setScale(0.15 * size).setDepth(DEPTH);
    for (let i = 0; i < sparks; i++) {
      const a = (i / sparks) * Math.PI * 2 + Math.random() * 0.4, d = rnd(40, 80) * size;
      const s = this.scene.add.image(p.x, p.y, "vfx-spark").setTint(i % 2 ? 0xffffff : color).setBlendMode(ADD).setDepth(DEPTH + 1).setScale(0.8 + Math.random() * 0.6);
      this.scene.tweens.add({ targets: s, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, scale: 0.1, alpha: 0, duration: 380 + rnd(0, 160), ease: "Quad.easeOut", onComplete: () => s.destroy() });
    }
    await Promise.all([
      this.tween({ targets: flash, scale: 1.4 * size, alpha: 0, duration: 260 }),
      this.tween({ targets: halo, scale: 1.6 * size, alpha: 0, duration: 380 }),
      this.tween({ targets: ring, scale: 1.3 * size, alpha: 0, duration: 420, ease: "Quad.easeOut" }),
    ]);
    flash.destroy(); halo.destroy(); ring.destroy();
  }

  private async travel(objs: Img[], from: Pt, to: Pt, ms: number, arc = 0, trailColor?: number) {
    const t = { v: 0 };
    let last = 0;
    await this.tween({ targets: t, v: 1, duration: ms, ease: "Sine.easeIn", onUpdate: () => {
      const x = Phaser.Math.Linear(from.x, to.x, t.v), y = Phaser.Math.Linear(from.y, to.y, t.v) - Math.sin(t.v * Math.PI) * arc;
      objs.forEach((o) => o.setPosition(x, y));
      if (trailColor !== undefined && this.scene.time.now - last > 18) {
        last = this.scene.time.now;
        const tr = this.glow(x, y, trailColor, 0.28, 0.6);
        this.scene.tweens.add({ targets: tr, scale: 0.05, alpha: 0, duration: 260, onComplete: () => tr.destroy() });
      }
    } });
  }

  private async lunge(user: Img, dir: number, dist = 36) {
    await this.tween({ targets: user, x: user.x + dist * dir, y: user.y - 10 * dir, duration: 100, yoyo: true, ease: "Quad.easeOut" });
  }

  private shake(ms = 180, k = 0.008) { this.scene.cameras.main.shake(ms, k); }

  private async magicCircle(s: Img, color: number, ms = 900) {
    const c = this.scene.add.image(s.x, s.y - 6, "vfx-circle").setTint(color).setBlendMode(ADD).setDepth(3).setScale(0.1, 0.035).setAlpha(0.95);
    const g = this.glow(s.x, s.y - 6, color, 0.2, 0.5).setDepth(3).setScale(1.4, 0.4);
    this.scene.tweens.add({ targets: c, angle: 180, duration: ms + 400 });
    await this.tween({ targets: c, scaleX: s === undefined ? 1 : Math.max(0.7, s.displayWidth / 140), scaleY: Math.max(0.24, s.displayWidth / 520), duration: 260, ease: "Back.easeOut" });
    // rising motes
    for (let i = 0; i < 14; i++) {
      const m = this.glow(s.x + rnd(-50, 50), s.y - rnd(0, 10), i % 2 ? 0xffffff : color, 0.12, 1);
      this.scene.tweens.add({ targets: m, y: m.y - rnd(60, 120), alpha: 0, duration: rnd(500, 900), delay: i * 35, onComplete: () => m.destroy() });
    }
    await this.wait(ms - 300);
    await this.tween({ targets: [c, g], alpha: 0, duration: 260 });
    c.destroy(); g.destroy();
  }

  private async claws(t: Pt, color: number, count = 3, key = "vfx-crescent", angle = 135) {
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * 18;
      const c = this.scene.add.image(t.x + off, t.y + off * 0.4, key).setTint(color).setBlendMode(ADD).setDepth(DEPTH).setAngle(angle).setScale(0.4).setAlpha(0);
      const w = this.scene.add.image(t.x + off, t.y + off * 0.4, key).setTint(0xffffff).setBlendMode(ADD).setDepth(DEPTH + 1).setAngle(angle).setScale(0.3).setAlpha(0);
      this.scene.tweens.add({ targets: [c, w], alpha: 1, duration: 50 });
      this.scene.tweens.add({ targets: [c, w], scale: "+=0.45", angle: `+=${30}`, alpha: 0, delay: 70, duration: 260, onComplete: () => { c.destroy(); w.destroy(); } });
      await this.wait(90);
    }
    await this.wait(200);
  }

  private async afterimages(user: Img, dir: number) {
    for (let i = 0; i < 5; i++) {
      const g = this.scene.add.image(user.x - dir * i * 14, user.y, user.texture.key).setOrigin(0.5, 1).setScale(user.scaleX, user.scaleY).setFlipX(user.flipX)
        .setTintFill(0xc8e8ff).setAlpha(0.55 - i * 0.09).setDepth(user.depth - 0.1).setBlendMode(ADD);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 320, delay: i * 30, onComplete: () => g.destroy() });
    }
  }

  private async speedLines(from: Pt, to: Pt, color: number) {
    const ang = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    for (let i = 0; i < 8; i++) {
      const s = this.scene.add.image(from.x + rnd(-30, 30), from.y + rnd(-30, 30), "vfx-streak").setTint(i % 2 ? 0xffffff : color).setBlendMode(ADD).setDepth(DEPTH).setRotation(ang).setScale(rnd(6, 12) / 10, 1);
      this.scene.tweens.add({ targets: s, x: to.x + rnd(-20, 20), y: to.y + rnd(-20, 20), alpha: 0, duration: 220, delay: i * 18, onComplete: () => s.destroy() });
    }
    await this.wait(200);
  }

  private async bolt(from: Pt, to: Pt, color: number, width = 1) {
    const g = this.scene.add.graphics().setDepth(DEPTH).setBlendMode(ADD);
    const pts: Phaser.Math.Vector2[] = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const jitter = i === 0 || i === n ? 0 : rnd(-22, 22);
      const nx = -(to.y - from.y), ny = to.x - from.x, len = Math.hypot(nx, ny) || 1;
      pts.push(new Phaser.Math.Vector2(Phaser.Math.Linear(from.x, to.x, t) + (nx / len) * jitter, Phaser.Math.Linear(from.y, to.y, t) + (ny / len) * jitter));
    }
    g.lineStyle(18 * width, color, 0.25).strokePoints(pts);
    g.lineStyle(9 * width, color, 0.7).strokePoints(pts);
    g.lineStyle(3 * width, 0xffffff, 1).strokePoints(pts);
    await this.wait(80);
    await this.tween({ targets: g, alpha: 0, duration: 140 });
    g.destroy();
  }

  private async powder(t: Pt, colors: number[], count = 28) {
    const ps = Array.from({ length: count }, (_, i) => {
      const p = this.glow(t.x + rnd(-60, 60), t.y - rnd(60, 110), colors[i % colors.length], rnd(8, 16) / 100, 0.95);
      return this.tween({ targets: p, y: t.y + rnd(0, 50), x: p.x + rnd(-20, 20), alpha: 0, duration: rnd(700, 1100), delay: i * 22, ease: "Sine.easeIn" }).then(() => p.destroy());
    });
    const cloud = this.glow(t.x, t.y, colors[0], 1.1, 0.25);
    this.scene.tweens.add({ targets: cloud, alpha: 0, scale: 1.6, duration: 1300, onComplete: () => cloud.destroy() });
    await Promise.all(ps);
  }

  private async soundWaves(u: Pt, t: Pt, color: number, count = 4) {
    const ang = Phaser.Math.Angle.Between(u.x, u.y, t.x, t.y);
    for (let i = 0; i < count; i++) {
      const g = this.scene.add.graphics().setDepth(DEPTH).setBlendMode(ADD);
      g.lineStyle(5, color, 0.9).beginPath(); g.arc(0, 0, 26, -0.6, 0.6); g.strokePath();
      g.lineStyle(2, 0xffffff, 1).beginPath(); g.arc(0, 0, 26, -0.6, 0.6); g.strokePath();
      g.setPosition(u.x, u.y).setRotation(ang);
      this.scene.tweens.add({ targets: g, x: t.x, y: t.y, scale: 2.4, alpha: 0, duration: 520, onComplete: () => g.destroy() });
      await this.wait(110);
    }
    await this.wait(380);
  }

  /* ---------------- signature effects ---------------- */

  /* Cinematic elemental beam: charge glyphs, converging particles, beam flash and impact. */
  private async cinematicBeam(c: Ctx, color: number, chargeMs = 560, beamMs = 480, impactScale = 1.7) {
    const cam = this.scene.cameras.main;
    const glyph = this.scene.add.image(c.u.x,c.u.y,"vfx-circle").setTint(color).setBlendMode(ADD).setDepth(DEPTH-2).setScale(0.08);
    const targetGlyph = this.scene.add.image(c.t.x,c.t.y,"vfx-circle").setTint(color).setBlendMode(ADD).setDepth(DEPTH-2).setScale(0.06).setAlpha(0);
    const orb = this.orb(c.u.x,c.u.y,color,0.85);
    const rings = [0,1,2].map(i=>this.scene.add.image(c.u.x,c.u.y,"vfx-ring").setTint(i===1?0xffffff:color).setBlendMode(ADD).setDepth(DEPTH-1).setScale(0.15+i*0.07));
    this.scene.tweens.add({targets:glyph,scale:0.78,angle:210,duration:chargeMs,ease:"Cubic.easeOut"});
    this.scene.tweens.add({targets:targetGlyph,scale:0.48,alpha:0.8,angle:-180,duration:chargeMs,ease:"Cubic.easeOut"});
    rings.forEach((r,i)=>this.scene.tweens.add({targets:r,scale:0.8+i*0.25,angle:i%2?260:-260,alpha:0.3,duration:chargeMs,delay:i*45}));
    const particles=Array.from({length:20},(_,i)=>{const a=i*Math.PI*2/20;const p=this.glow(c.u.x+Math.cos(a)*90,c.u.y+Math.sin(a)*90,color,0.12,0.9,"vfx-core");return this.tween({targets:p,x:c.u.x,y:c.u.y,scale:0.42,alpha:0,duration:chargeMs,delay:i*9}).then(()=>p.destroy());});
    await this.wait(chargeMs);cam.flash(120,210,175,255,false);
    const beam=this.scene.add.graphics().setDepth(DEPTH+2).setBlendMode(ADD);
    beam.lineStyle(70,color,0.25).lineBetween(c.u.x,c.u.y,c.t.x,c.t.y);
    beam.lineStyle(34,color,0.7).lineBetween(c.u.x,c.u.y,c.t.x,c.t.y);
    beam.lineStyle(12,0xffffff,1).lineBetween(c.u.x,c.u.y,c.t.x,c.t.y);
    const core=this.glow((c.u.x+c.t.x)/2,(c.u.y+c.t.y)/2,color,0.35,1);
    await Promise.all([this.tween({targets:beam,alpha:0,duration:beamMs,ease:"Cubic.easeOut"}),this.tween({targets:core,scale:1.45,alpha:0,duration:beamMs})]);beam.destroy();core.destroy();
    cam.shake(280,0.016);cam.flash(210,255,255,255,false);
    await Promise.all([this.burst(c.t,color,impactScale,30),this.burst(c.t,0xffffff,impactScale*0.55,20),this.crackle(c.t,color),this.tween({targets:c.target,scaleX:c.target.scaleX*0.82,scaleY:c.target.scaleY*0.82,angle:c.dir*6,duration:90,yoyo:true,repeat:2})]);
    [glyph,targetGlyph,...orb,...rings].forEach(o=>o.destroy());await Promise.all(particles);
  }

  private signatures: Record<string, (c: Ctx) => Promise<void>> = {
    tackle: async (c) => { void this.afterimages(c.user, c.dir); await this.lunge(c.user, c.dir, 44); this.shake(); await this.burst(c.t, 0xffffff, 1.1); },
    slam: async (c) => { await this.lunge(c.user, c.dir, 50); this.shake(260, 0.012); await this.burst(c.t, 0xfff0c0, 1.5, 14); },
    rage: async (c) => { void this.auraFlames(c.user, 0xf04030); await this.lunge(c.user, c.dir); await this.burst(c.t, 0xf86040, 1); },
    hornattack: async (c) => { await this.lunge(c.user, c.dir, 46); await this.claws(c.t, 0xffffff, 1, "vfx-needle", c.dir > 0 ? -20 : 200); this.shake(); await this.burst(c.t, 0xffffff, 1); },
    scratch: async (c) => { await this.lunge(c.user, c.dir, 26); await this.claws(c.t, 0xffffff, 3); },
    furyattack: async (c) => { for (let i = 0; i < 3; i++) { await this.claws({ x: c.t.x + rnd(-20, 20), y: c.t.y + rnd(-16, 16) }, 0xfff0d0, 1, "vfx-needle", rnd(0, 360)); } await this.burst(c.t, 0xffffff, 0.8); },
    metalclaw: async (c) => { await this.lunge(c.user, c.dir, 30); await this.claws(c.t, 0xa8c8ff, 3); for (let i = 0; i < 6; i++) { const s = this.glow(c.t.x + rnd(-40, 40), c.t.y + rnd(-40, 40), 0xffffff, 0.15, 1, "vfx-spark"); this.scene.tweens.add({ targets: s, scale: 1, alpha: 0, angle: 90, duration: 380, delay: i * 40, onComplete: () => s.destroy() }); } await this.wait(300); },
    quickattack: async (c) => { void this.afterimages(c.user, c.dir); await this.speedLines(c.u, c.t, 0xd8f0ff); await this.lunge(c.user, c.dir, 60); await this.burst(c.t, 0xd8f0ff, 1.1); },
    bite: async (c) => this.jaws(c.t, 0x8040c0),
    hyperfang: async (c) => { await this.lunge(c.user, c.dir); await this.jaws(c.t, 0xffffff); this.shake(220, 0.01); },
    pursuit: async (c) => { await this.dimBg(true, 0.35); void this.afterimages(c.user, c.dir); await this.lunge(c.user, c.dir, 50); await this.claws(c.t, 0x9050d0, 2); await this.dimBg(false); },
    ember: async (c) => {
      const shots = [0, 1, 2].map(async (i) => {
        await this.wait(i * 120);
        const f = this.scene.add.image(c.u.x, c.u.y, "vfx-flame").setBlendMode(ADD).setDepth(DEPTH).setScale(0.9);
        const orbParts = this.orb(c.u.x, c.u.y, 0xf87828, 0.8);
        await this.travel([f, ...orbParts], c.u, { x: c.t.x + (i - 1) * 16, y: c.t.y + (i - 1) * 8 }, 360, 40, 0xf8a040);
        f.destroy(); orbParts.forEach((o) => o.destroy());
        await this.burst({ x: c.t.x + (i - 1) * 16, y: c.t.y }, 0xf86020, 0.8, 6);
      });
      await Promise.all(shots);
      await this.flameRise(c.t, 0.9);
    },
    watergun: async (c) => {
      await this.dimBg(true, 0.25);
      const drops: Promise<void>[] = [];
      for (let i = 0; i < 22; i++) {
        const orbParts = this.orb(c.u.x, c.u.y, 0x3890f0, 0.45);
        drops.push(this.travel(orbParts, c.u, { x: c.t.x + rnd(-10, 10), y: c.t.y + rnd(-8, 8) }, 280, 18).then(() => { orbParts.forEach((o) => o.destroy()); }));
        await this.wait(18);
      }
      await Promise.all(drops);
      await Promise.all([this.burst(c.t, 0x60b0ff, 1.2, 12), this.splash(c.t, 0x88c8ff)]);
      await this.dimBg(false);
    },
    bubble: async (c) => {
      const bs = Array.from({ length: 12 }, async (_, i) => {
        await this.wait(i * 50);
        const b = this.scene.add.image(c.u.x, c.u.y, "vfx-bubble").setTint(0xa8d8ff).setDepth(DEPTH).setScale(rnd(6, 12) / 10);
        const end = { x: c.t.x + rnd(-40, 40), y: c.t.y + rnd(-30, 30) };
        const t = { v: 0 }, ph = Math.random() * 6;
        await this.tween({ targets: t, v: 1, duration: 600, onUpdate: () => { b.x = Phaser.Math.Linear(c.u.x, end.x, t.v) + Math.sin(t.v * 9 + ph) * 10; b.y = Phaser.Math.Linear(c.u.y, end.y, t.v); } });
        await this.tween({ targets: b, scale: b.scale * 1.6, alpha: 0, duration: 120 });
        b.destroy();
      });
      await Promise.all(bs);
    },
    vinewhip: async (c) => { await this.vines(c.u, c.t); this.shake(140, 0.006); await this.burst(c.t, 0x78d850, 1, 8); },
    razorleaf: async (c) => {
      const ls = Array.from({ length: 10 }, async (_, i) => {
        await this.wait(i * 45);
        const l = this.scene.add.image(c.u.x, c.u.y, "vfx-leaf").setDepth(DEPTH).setScale(1.4);
        const g = this.glow(c.u.x, c.u.y, 0x78e860, 0.3, 0.7);
        const t = { v: 0 }, side = i % 2 ? 1 : -1;
        await this.tween({ targets: t, v: 1, duration: 520, onUpdate: () => {
          const x = Phaser.Math.Linear(c.u.x, c.t.x, t.v), y = Phaser.Math.Linear(c.u.y, c.t.y, t.v) + Math.sin(t.v * Math.PI) * 70 * side;
          l.setPosition(x, y).setRotation(t.v * 20); g.setPosition(x, y);
        } });
        l.destroy(); g.destroy();
      });
      await Promise.all(ls);
      await this.claws(c.t, 0x88f070, 2);
    },
    absorb: async (c) => this.drain(c.t, c.u, c.user, 0x68e050, 10),
    megadrain: async (c) => this.drain(c.t, c.u, c.user, 0x68e050, 16),
    gigadrain: async (c) => this.drain(c.t, c.u, c.user, 0x58f040, 22),
    leechseed: async (c) => {
      const seeds = [0, 1, 2].map(async (i) => {
        const orbParts = this.orb(c.u.x, c.u.y, 0x98d040, 0.35);
        await this.travel(orbParts, c.u, { x: c.t.x + (i - 1) * 20, y: c.t.y + 24 }, 420 + i * 60, 70);
        orbParts.forEach((o) => o.destroy());
      });
      await Promise.all(seeds);
      await this.vinesAround(c.t, 0x58b040);
    },
    poisonsting: async (c) => this.needles(c.u, c.t, 0xc050e0, 1),
    twineedle: async (c) => this.needles(c.u, c.t, 0xd0e040, 2),
    pinmissile: async (c) => this.needles(c.u, c.t, 0xd0e040, 4),
    poisonpowder: async (c) => this.powder(c.t, [0xb048d0, 0xe080f8, 0x8030a0]),
    sleeppowder: async (c) => this.powder(c.t, [0x6890f8, 0xb0c8ff, 0x4060d0]),
    stunspore: async (c) => this.powder(c.t, [0xf8d830, 0xfff080, 0xe0a020]),
    sweetscent: async (c) => this.powder(c.t, [0xf898c8, 0xffd0e8, 0xe070a8], 20),
    thundershock: async (c) => {
      await this.dimBg(true, 0.5);
      for (let i = 0; i < 3; i++) { this.scene.cameras.main.flash(70, 255, 250, 190); await this.bolt(c.u, { x: c.t.x + rnd(-10, 10), y: c.t.y + rnd(-10, 10) }, 0xf8d030); }
      await Promise.all([this.burst(c.t, 0xf8e040, 1.2, 14), this.crackle(c.t, 0xf8e040)]);
      await this.dimBg(false);
    },
    thunderwave: async (c) => {
      await this.dimBg(true, 0.4);
      for (let i = 0; i < 3; i++) {
        const r = this.scene.add.image(c.t.x, c.t.y, "vfx-ring").setTint(0xf8e040).setBlendMode(ADD).setDepth(DEPTH).setScale(1.4).setAlpha(0);
        this.scene.tweens.add({ targets: r, scale: 0.2, alpha: 1, duration: 360, onComplete: () => r.destroy() });
        await this.wait(140);
      }
      await this.crackle(c.t, 0xf8e040);
      await this.dimBg(false);
    },
    gust: async (c) => this.tornado(c.t, 0xe8f4ff),
    whirlwind: async (c) => this.tornado(c.t, 0xd8e8f8),
    peck: async (c) => { await this.lunge(c.user, c.dir, 40); for (let i = 0; i < 2; i++) { await this.claws({ x: c.t.x + rnd(-14, 14), y: c.t.y + rnd(-14, 14) }, 0xffffff, 1, "vfx-needle", c.dir > 0 ? -25 : 205); } await this.burst(c.t, 0xffffff, 0.8); },
    confusion: async (c) => {
      await this.dimBg(true, 0.45);
      void this.magicCircle(c.target, 0xf870b8, 1000);
      for (let i = 0; i < 3; i++) {
        const r = this.scene.add.image(c.t.x, c.t.y, "vfx-ring").setTint(0xf878c0).setBlendMode(ADD).setDepth(DEPTH).setScale(0.2);
        this.scene.tweens.add({ targets: r, scale: 1.8, alpha: 0, duration: 600, onComplete: () => r.destroy() });
        await this.wait(160);
      }
      const sx = c.target.scaleX;
      await this.tween({ targets: c.target, scaleX: sx * 0.82, duration: 80, yoyo: true, repeat: 3 });
      await this.dimBg(false);
    },
    doublekick: async (c) => { for (let i = 0; i < 2; i++) { await this.lunge(c.user, c.dir, 30); this.shake(120, 0.008); await this.burst({ x: c.t.x + (i ? 14 : -14), y: c.t.y + (i ? 10 : -10) }, 0xf8a040, 0.9, 8); } },
    sandattack: async (c) => {
      const ps = Array.from({ length: 26 }, async (_, i) => {
        await this.wait(i * 12);
        const p = this.scene.add.image(c.u.x, c.u.y + 30, "vfx-core").setTint(i % 2 ? 0xe0c070 : 0xb89050).setDepth(DEPTH).setScale(rnd(3, 7) / 10);
        await this.tween({ targets: p, x: c.t.x + rnd(-30, 30), y: c.t.y + rnd(-20, 20), duration: 320, ease: "Quad.easeOut" });
        await this.tween({ targets: p, alpha: 0, duration: 200 });
        p.destroy();
      });
      await Promise.all(ps);
    },
    rockthrow: async (c) => this.rocks(c.t, 3),
    rockslide: async (c) => this.rocks(c.t, 6),
    magnitude: async (c) => this.quake(c.t),
    selfdestruct: async (c) => this.explosion(c.u),
    explosion: async (c) => this.explosion(c.u),
    growl: async (c) => this.soundWaves(c.u, c.t, 0xf8c8a0),
    supersonic: async (c) => this.soundWaves(c.u, c.t, 0xa8e8ff, 5),
    leer: async (c) => this.eyes(c.user, c.target, 0xff3030),
    scaryface: async (c) => { await this.dimBg(true, 0.55); await this.eyes(c.user, c.target, 0xff2020); await this.dimBg(false); },
    tailwhip: async (c) => { await this.tween({ targets: c.user, angle: 8 * c.dir, duration: 90, yoyo: true, repeat: 2 }); await this.soundWaves(c.u, c.t, 0xfff0d0, 2); },
    harden: async (c) => this.shield(c.user, 0xd8e8ff),
    withdraw: async (c) => this.shield(c.user, 0x78b8f8),
    defensecurl: async (c) => this.shield(c.user, 0xf8d8b0),
    focusenergy: async (c) => { void this.magicCircle(c.user, 0xf86030, 900); await this.auraFlames(c.user, 0xf86030); },
    doubleteam: async (c) => {
      const clones = [-1, 1, -2, 2].map(() => this.scene.add.image(c.user.x, c.user.y, c.user.texture.key).setOrigin(0.5, 1).setScale(c.user.scaleX, c.user.scaleY).setFlipX(c.user.flipX).setAlpha(0.5).setDepth(c.user.depth - 0.1).setTintFill(0xc8e0ff).setBlendMode(ADD));
      await Promise.all(clones.map((cl, i) => this.tween({ targets: cl, x: c.user.x + [-1, 1, -2, 2][i] * 28, duration: 200, yoyo: true, repeat: 1 })));
      clones.forEach((cl) => cl.destroy());
    },
    smokescreen: async (c) => {
      const ps = Array.from({ length: 14 }, async (_, i) => {
        const p = this.scene.add.image(c.t.x + rnd(-50, 50), c.t.y + rnd(-30, 30), "vfx-glow").setTint(i % 2 ? 0x606068 : 0x909098).setDepth(DEPTH).setScale(0.2).setAlpha(0.85);
        await this.tween({ targets: p, scale: rnd(7, 11) / 10, alpha: 0, duration: 900, delay: i * 40 });
        p.destroy();
      });
      await Promise.all(ps);
    },
    stringshot: async (c) => {
      for (let i = 0; i < 3; i++) {
        const g = this.scene.add.graphics().setDepth(DEPTH).setBlendMode(ADD);
        const end = { x: c.t.x + rnd(-24, 24), y: c.t.y + rnd(-24, 24) };
        g.lineStyle(4, 0xffffff, 0.9).beginPath(); g.moveTo(c.u.x, c.u.y); g.lineTo(end.x, end.y); g.strokePath();
        g.lineStyle(10, 0xe8f0ff, 0.25).beginPath(); g.moveTo(c.u.x, c.u.y); g.lineTo(end.x, end.y); g.strokePath();
        this.scene.tweens.add({ targets: g, alpha: 0, duration: 700, delay: 200, onComplete: () => g.destroy() });
        await this.wait(120);
      }
      await this.wait(500);
    },
    helpinghand: async (c) => this.magicCircle(c.user, 0xf8d860, 800),
    mudsport: async (c) => this.powder(c.u, [0x987048, 0xc8a070], 16),
    shadowball: async (c) => { await this.dimBg(true,0.68); const o=this.orb(c.u.x,c.u.y,0x852bff,1.25); const core=this.glow(c.u.x,c.u.y,0x19002e,0.65,1); await this.travel([...o,core],c.u,c.t,620,95,0xb85cff); await this.burst(c.t,0x9b36ff,1.8,30); await this.crackle(c.t,0xb45cff); o.forEach(x=>x.destroy());core.destroy();await this.dimBg(false); },
    icebeam: async (c) => this.cinematicBeam(c,0x65dcff,440,430,1.65),
    hyperbeam: async (c) => this.cinematicBeam(c,0xffa52e,760,620,2.15),
    thunderbolt: async (c) => { await this.dimBg(true,0.62); for(let i=0;i<5;i++) await this.bolt(c.u,{x:c.t.x+rnd(-34,34),y:c.t.y+rnd(-38,30)},0xffef55); await this.burst(c.t,0xffe64d,1.7,26); await this.crackle(c.t,0xffef55); await this.dimBg(false); },
    flamethrower: async (c) => { await this.dimBg(true,0.52); const beam=this.glow(c.u.x,c.u.y,0xff6125,0.5,1); await this.tween({targets:beam,x:c.t.x,y:c.t.y,scale:1.45,alpha:0.1,duration:560});beam.destroy();await this.flameRise(c.t,1.8);await this.burst(c.t,0xff5b22,1.7,24);await this.dimBg(false); },
    solarbeam: async (c) => this.cinematicBeam(c,0x9dff58,720,570,1.95),
    blizzard: async (c) => { await this.cinematicBeam(c,0x9cecff,600,520,1.8); await this.powder(c.t,[0xffffff,0x92eaff,0xceeaff],48); },
    surf: async (c) => { await this.dimBg(true,0.5); await this.splash(c.t,0x44bfff); const w=this.scene.add.image(c.u.x,c.u.y,"vfx-crescent").setTint(0x54cfff).setBlendMode(ADD).setDepth(DEPTH).setAngle(90).setScale(0.45,0.8); await this.tween({targets:w,x:c.t.x,y:c.t.y,scaleX:2.3,scaleY:1.5,alpha:0,duration:620});w.destroy();await this.burst(c.t,0x54cfff,1.8,26);await this.dimBg(false); },
    wingattack: async (c) => { await this.speedLines(c.u,c.t,0xdaf4ff); await this.featherStorm(c.u,c.t,0xeafaff,12); await this.lunge(c.user,c.dir,48); await this.claws(c.t,0xffffff,2,"vfx-crescent",c.dir>0?135:315); await this.impactSeal(c.t,0x9cecff,1.25); },
    aerialace: async (c) => { await this.dimBg(true,0.62); void this.afterimages(c.user,c.dir); await this.speedLines(c.u,c.t,0x9cecff); await this.lunge(c.user,c.dir,64); await this.claws(c.t,0xffffff,3,"vfx-crescent",c.dir>0?135:315); await this.claws(c.t,0x9cecff,2,"vfx-crescent",c.dir>0?45:225); await this.impactSeal(c.t,0x9cecff,1.55); await this.dimBg(false); },
    drillpeck: async (c) => { await this.dimBg(true,0.52); const ring=this.scene.add.image(c.u.x,c.u.y,"vfx-ring").setTint(0xffe9a0).setBlendMode(ADD).setDepth(DEPTH).setScale(0.2); await this.tween({targets:ring,angle:720,scale:1.1,x:c.t.x,y:c.t.y,duration:420}); ring.destroy(); await this.speedLines(c.u,c.t,0xffe9a0); await this.lunge(c.user,c.dir,54); await this.claws(c.t,0xffffff,4,"vfx-needle",c.dir>0?-18:198); await this.impactSeal(c.t,0xffd56a,1.35); await this.dimBg(false); },
    thunder: async (c) => { await this.dimBg(true,0.78); const charge=this.orb(c.u.x,c.u.y,0xffe84a,1.25); const rings=[0,1,2].map(i=>this.scene.add.image(c.u.x,c.u.y,"vfx-ring").setTint(i===1?0xffffff:0xffd82d).setBlendMode(ADD).setDepth(DEPTH).setScale(0.2+i*0.08)); rings.forEach((r,i)=>this.scene.tweens.add({targets:r,angle:360*(i%2? -1:1),scale:1.15+i*.18,alpha:.45,duration:520,delay:i*65})); await this.wait(560); this.scene.cameras.main.flash(120,255,248,170,false); await Promise.all(Array.from({length:7},(_,i)=>this.bolt({x:c.t.x+(i-3)*18,y:c.t.y-150-rnd(0,70)},{x:c.t.x+rnd(-24,24),y:c.t.y+rnd(-18,24)},0xffe52e,1.35))); await this.impactSeal(c.t,0xffe52e,1.9); await this.crackle(c.t,0xfff7a0); charge.forEach(o=>o.destroy());rings.forEach(o=>o.destroy());await this.dimBg(false); },
    headbutt: async (c) => { void this.afterimages(c.user,c.dir); await this.lunge(c.user,c.dir,54); this.scene.cameras.main.flash(75,255,245,205,false); await this.impactSeal(c.t,0xffe2a0,1.45); await this.burst(c.t,0xffffff,1.25,18); },
    earthquake: async (c) => { await this.dimBg(true,0.48); await this.quake(c.t); await this.impactSeal(c.t,0xc49a68,1.55); await this.dimBg(false); },
    psychic: async (c) => { await this.dimBg(true,0.72); await this.magicCircle(c.target,0xc080ff,1180); const rings=[0,1,2].map(i=>this.scene.add.image(c.t.x,c.t.y,"vfx-ring").setTint(i===1?0xffffff:0xb46cff).setBlendMode(ADD).setDepth(DEPTH).setScale(.15)); await Promise.all(rings.map((r,i)=>this.tween({targets:r,scale:1.8+i*.25,angle:i%2?220:-220,alpha:0,duration:560,delay:i*80})));rings.forEach(r=>r.destroy());await this.impactSeal(c.t,0xb46cff,1.65);await this.dimBg(false); },
    dragonclaw: async (c) => { await this.dimBg(true,0.42); await this.claws(c.t,0x68c8ff,3,"vfx-crescent",c.dir>0?135:315); await this.burst(c.t,0x8cecff,1.35,18); await this.dimBg(false); },
    dragonpulse: async (c) => this.cinematicBeam(c,0x4c9cff,520,460,1.75),
    aurasphere: async (c) => { const o=this.orb(c.u.x,c.u.y,0x5bbcff,0.95); await this.travel(o,c.u,c.t,520,45,0xb8eaff); await this.burst(c.t,0x72d8ff,1.65,26); o.forEach(x=>x.destroy()); },
    darkpulse: async (c) => { await this.dimBg(true,0.62); await this.soundWaves(c.u,c.t,0x9c42e8,5); await this.burst(c.t,0x6620b8,1.7,28); await this.dimBg(false); },
    shadowclaw: async (c) => { await this.dimBg(true,0.55); await this.claws(c.t,0x9b5bff,4,"vfx-crescent",c.dir>0?135:315); await this.burst(c.t,0x5b2b9e,1.25,20); await this.dimBg(false); },
    airslash: async (c) => { await this.speedLines(c.u,c.t,0xd8f4ff); await this.claws(c.t,0xffffff,2,"vfx-crescent",c.dir>0?145:325); await this.burst(c.t,0x9beaff,1.3,18); },
    irontail: async (c) => { await this.lunge(c.user,c.dir,34); await this.claws(c.t,0xc8e8ff,2,"vfx-crescent",c.dir>0?100:280); this.shake(240,0.012); await this.burst(c.t,0xffffff,1.4,22); },
    leafblade: async (c) => { await this.lunge(c.user,c.dir,38); await this.claws(c.t,0x68e050,3,"vfx-crescent",c.dir>0?135:315); await this.powder(c.t,[0x60d850,0xb8f888],18); },
    hydropump: async (c) => this.cinematicBeam(c,0x3bbdff,450,480,1.9),
    fireblast: async (c) => { await this.dimBg(true,0.5); await this.cinematicBeam(c,0xff6728,400,430,1.8); await this.flameRise(c.t,2.1); await this.dimBg(false); },
    rockblast: async (c) => { for(let i=0;i<5;i++) await this.rocks({x:c.t.x+rnd(-26,26),y:c.t.y+rnd(-24,24)},1); },
    brickbreak: async (c) => { await this.lunge(c.user,c.dir,42); await this.claws(c.t,0xffd18a,2); this.shake(250,0.014); await this.burst(c.t,0xffd18a,1.45,22); },
    crosschop: async (c) => { await this.lunge(c.user,c.dir,42); await this.claws(c.t,0xffe0b0,2,"vfx-crescent",45); await this.claws(c.t,0xffe0b0,2,"vfx-crescent",135); this.shake(250,0.014); },
    bodyslam: async (c) => { await this.lunge(c.user,c.dir,52); this.shake(280,0.016); await this.burst(c.t,0xffe8b8,1.6,24); },
    nightshade: async (c) => { await this.dimBg(true,0.72); await this.travel(this.orb(c.u.x,c.u.y,0x542080,0.9),c.u,c.t,500,65,0x9c68df); await this.burst(c.t,0x6420a8,1.5,24); await this.dimBg(false); },
    meteormash: async (c) => { await this.lunge(c.user,c.dir,42); await this.claws(c.t,0xb8d8ff,3); await this.burst(c.t,0xeff8ff,1.6,24); },
    extrasensory: async (c) => { await this.dimBg(true,0.55); await this.magicCircle(c.target,0x8c6cff,780); await this.burst(c.t,0xbaa8ff,1.45,22); await this.dimBg(false); },
    perishsong: async (c) => { await this.dimBg(true,0.6); await this.soundWaves(c.u,c.t,0xb8a8ff,6); await this.burst(c.t,0x7868d8,1.2,18); await this.dimBg(false); },
    waterfall: async (c) => { await this.splash(c.t,0x48aaff); await this.lunge(c.user,c.dir,45); await this.burst(c.t,0x70d8ff,1.5,24); },
    meteorbeam: async (c) => this.cinematicBeam(c,0x8fcaff,650,560,1.9),
  };

  /* ---------------- composite helpers ---------------- */

  /** Anime-style impact punctuation: layered glyph rings, radial streaks and a delayed white-hot flash. */
  private async impactSeal(t: Pt, color: number, scale = 1) {
    const cam=this.scene.cameras.main, col=Phaser.Display.Color.IntegerToColor(color);
    const rings=[0,1,2].map(i=>this.scene.add.image(t.x,t.y,"vfx-ring").setTint(i===1?0xffffff:color).setBlendMode(ADD).setDepth(DEPTH+1).setScale(.12+i*.08).setAlpha(.9));
    rings.forEach((r,i)=>this.scene.tweens.add({targets:r,scale:(1.25+i*.42)*scale,angle:i%2?220:-260,alpha:0,duration:420+i*90,delay:i*45,ease:"Cubic.easeOut"}));
    const rays=this.scene.add.graphics().setDepth(DEPTH+2).setBlendMode(ADD);
    for(let i=0;i<16;i++){const a=i*Math.PI/8,len=(35+(i%4)*18)*scale;rays.lineStyle(i%3===0?5:2,i%4===0?0xffffff:color,.85).lineBetween(t.x+Math.cos(a)*12,t.y+Math.sin(a)*12,t.x+Math.cos(a)*len,t.y+Math.sin(a)*len);}
    const core=this.glow(t.x,t.y,0xffffff,.25*scale,1);
    cam.flash(90,col.red,col.green,col.blue,false);cam.shake(190,.009*scale);
    await Promise.all([this.tween({targets:rays,alpha:0,scale:1.12,duration:330}),this.tween({targets:core,scale:1.3*scale,alpha:0,duration:260})]);
    rays.destroy();core.destroy();rings.forEach(r=>r.destroy());
  }

  /** Universal anime hit climax: camera punch, prismatic shock rings, radial slash rays and a white-hot core. */
  private async cinematicImpact(target: Img, p: Pt, color: number, intensity: number) {
    const cam = this.scene.cameras.main, baseZoom = cam.zoom;
    const col = Phaser.Display.Color.IntegerToColor(color);
    const halo = this.glow(p.x, p.y, color, 1.25 * intensity, 0.9);
    const core = this.glow(p.x, p.y, 0xffffff, 0.38 * intensity, 1);
    const rings = [0, 1, 2, 3].map((i) => this.scene.add.image(p.x, p.y, "vfx-ring")
      .setTint(i % 2 ? 0xffffff : color).setBlendMode(ADD).setDepth(DEPTH + 4)
      .setScale(0.08 + i * 0.04).setAlpha(0.95));
    const rays = this.scene.add.graphics().setDepth(DEPTH + 5).setBlendMode(ADD);
    for (let i = 0; i < 28; i++) {
      const a = i * Math.PI * 2 / 28, inner = 14 + (i % 3) * 5, outer = (72 + (i % 5) * 22) * intensity;
      rays.lineStyle(i % 4 === 0 ? 4 : 1.5, i % 5 === 0 ? 0xffffff : color, 0.9);
      rays.lineBetween(p.x + Math.cos(a) * inner, p.y + Math.sin(a) * inner,
        p.x + Math.cos(a) * outer, p.y + Math.sin(a) * outer);
    }
    target.setTintFill(0xffffff);
    this.scene.time.delayedCall(95, () => target.clearTint());
    cam.flash(105, col.red, col.green, col.blue, false);
    cam.shake(220, 0.0065 * intensity);
    await Promise.all([
      this.tween({ targets: rings, scale: 1.55 * intensity, alpha: 0, angle: 180, duration: 480, ease: "Cubic.easeOut" }),
      this.tween({ targets: [halo, core], scale: 0.12, alpha: 0, duration: 330, ease: "Quad.easeOut" }),
      this.tween({ targets: rays, alpha: 0, scale: 1.08, duration: 350 }),
      this.tween({ targets: cam, zoom: baseZoom * (1.025 + intensity * 0.018), duration: 110, yoyo: true, hold: 50, ease: "Quad.easeOut" }),
    ]);
    rings.forEach((r) => r.destroy()); halo.destroy(); core.destroy(); rays.destroy();
  }

  /** Sweeping luminous feathers that curve into the impact, not static damage sparks. */
  private async featherStorm(from: Pt, to: Pt, color: number, count = 10) {
    const ps=Array.from({length:count},async(_,i)=>{
      await this.wait(i*22);
      const side=i%2?1:-1, start={x:from.x+rnd(-18,18),y:from.y+rnd(-18,18)};
      const leaf=this.scene.add.image(start.x,start.y,"vfx-leaf").setTint(color).setBlendMode(ADD).setDepth(DEPTH+1).setScale(.7+rnd(0,5)/10);
      const t={v:0}, ang=Phaser.Math.Angle.Between(from.x,from.y,to.x,to.y);
      await this.tween({targets:t,v:1,duration:380+rnd(0,180),ease:"Sine.easeIn",onUpdate:()=>{
        const x=Phaser.Math.Linear(start.x,to.x,t.v),y=Phaser.Math.Linear(start.y,to.y,t.v)+Math.sin(t.v*Math.PI)*side*42;
        leaf.setPosition(x,y).setRotation(ang+side*t.v*2.4).setAlpha(1-t.v*.55);
      }});
      await this.tween({targets:leaf,scale:.05,alpha:0,duration:120});leaf.destroy();
    });
    await Promise.all(ps);
  }

  private async jaws(t: Pt, color: number) {
    const top = this.scene.add.image(t.x, t.y - 50, "vfx-crescent").setTint(color).setBlendMode(ADD).setDepth(DEPTH).setAngle(90).setScale(0.8, 0.6);
    const bot = this.scene.add.image(t.x, t.y + 50, "vfx-crescent").setTint(color).setBlendMode(ADD).setDepth(DEPTH).setAngle(-90).setScale(0.8, 0.6);
    await Promise.all([this.tween({ targets: top, y: t.y - 10, duration: 160, ease: "Quad.easeIn" }), this.tween({ targets: bot, y: t.y + 10, duration: 160, ease: "Quad.easeIn" })]);
    this.shake(140, 0.008);
    void this.burst(t, color, 0.9, 8);
    await this.tween({ targets: [top, bot], alpha: 0, duration: 220 });
    top.destroy(); bot.destroy();
  }

  private async flameRise(t: Pt, size = 1) {
    const fs = Array.from({ length: 14 }, async (_, i) => {
      await this.wait(i * 30);
      const f = this.scene.add.image(t.x + rnd(-36, 36) * size, t.y + rnd(10, 40), "vfx-flame").setBlendMode(ADD).setDepth(DEPTH).setScale(rnd(6, 11) / 10 * size);
      await this.tween({ targets: f, y: f.y - rnd(50, 90), scale: 0.15, alpha: 0, duration: rnd(450, 700), ease: "Quad.easeOut" });
      f.destroy();
    });
    await Promise.all(fs);
  }

  private async auraFlames(s: Img, color: number) {
    const fs = Array.from({ length: 16 }, async (_, i) => {
      await this.wait(i * 35);
      const f = this.scene.add.image(s.x + rnd(-40, 40), s.y - rnd(0, 20), "vfx-flame").setTint(color).setBlendMode(ADD).setDepth(DEPTH).setScale(0.7);
      await this.tween({ targets: f, y: f.y - rnd(70, 110), alpha: 0, scale: 0.2, duration: 650 });
      f.destroy();
    });
    await Promise.all(fs);
  }

  private async splash(t: Pt, color: number) {
    const ds = Array.from({ length: 12 }, async (_, i) => {
      const a = -Math.PI / 2 + (i / 11 - 0.5) * 2.4;
      const d = this.glow(t.x, t.y + 10, color, 0.18, 1);
      await this.tween({ targets: d, x: t.x + Math.cos(a) * 60, y: t.y + Math.sin(a) * 50 + 20, alpha: 0, duration: 480, ease: "Quad.easeOut" });
      d.destroy();
    });
    await Promise.all(ds);
  }

  private async vines(u: Pt, t: Pt) {
    for (const side of [-1, 1]) {
      const g = this.scene.add.graphics().setDepth(DEPTH);
      const t0 = { v: 0 };
      const ctrl = { x: (u.x + t.x) / 2, y: Math.min(u.y, t.y) - 90 * (side > 0 ? 1 : 0.4) };
      await this.tween({ targets: t0, v: 1, duration: 240, onUpdate: () => {
        g.clear();
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(u.x, u.y), new Phaser.Math.Vector2(ctrl.x, ctrl.y + side * 30), new Phaser.Math.Vector2(t.x, t.y));
        const pts = curve.getPoints(24).slice(0, Math.max(2, Math.floor(25 * t0.v)));
        g.lineStyle(9, 0x2c7a30, 1).strokePoints(pts);
        g.lineStyle(5, 0x58c048, 1).strokePoints(pts);
        g.lineStyle(2, 0xa8f080, 1).strokePoints(pts);
      } });
      this.shake(80, 0.005);
      void this.claws(t, 0xa8f080, 1, "vfx-crescent", side > 0 ? 120 : 240);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, delay: 80, onComplete: () => g.destroy() });
      await this.wait(120);
    }
  }

  private async vinesAround(t: Pt, color: number) {
    const g = this.scene.add.graphics().setDepth(DEPTH);
    const tw = { v: 0 };
    await this.tween({ targets: tw, v: 1, duration: 500, onUpdate: () => {
      g.clear().lineStyle(4, color, 1);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        for (let i = 0; i <= 30 * tw.v; i++) {
          const a = i * 0.35 + k * 2.1, r = 20 + i * 1.2;
          const x = t.x + Math.cos(a) * r, y = t.y + 30 - i * 2.2;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokePath();
      }
    } });
    await this.tween({ targets: g, alpha: 0, duration: 300 });
    g.destroy();
  }

  private async drain(from: Pt, to: Pt, user: Img, color: number, count: number) {
    const os = Array.from({ length: count }, async (_, i) => {
      await this.wait(i * 45);
      const orbParts = this.orb(from.x + rnd(-30, 30), from.y + rnd(-30, 30), color, 0.35);
      await this.travel(orbParts, { x: orbParts[1].x, y: orbParts[1].y }, to, 520, rnd(-60, 60), color);
      orbParts.forEach((o) => o.destroy());
    });
    await Promise.all(os);
    user.setTint(0xb8ffb0);
    await this.magicCircle(user, color, 600);
    user.clearTint();
  }

  private async needles(u: Pt, t: Pt, color: number, count: number) {
    const ang = Phaser.Math.Angle.Between(u.x, u.y, t.x, t.y);
    for (let i = 0; i < count; i++) {
      const n = this.scene.add.image(u.x, u.y, "vfx-needle").setTint(color).setBlendMode(ADD).setDepth(DEPTH).setRotation(ang).setScale(1.6, 1.4);
      const h = this.glow(u.x, u.y, color, 0.25, 0.8);
      const end = { x: t.x + rnd(-12, 12), y: t.y + rnd(-12, 12) };
      await this.travel([n, h], u, end, 200, 0, color);
      n.destroy(); h.destroy();
      void this.burst(end, color, 0.6, 6);
    }
    await this.wait(300);
  }

  private async crackle(t: Pt, color: number) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      void this.bolt({ x: t.x + Math.cos(a) * 10, y: t.y + Math.sin(a) * 10 }, { x: t.x + Math.cos(a) * 60, y: t.y + Math.sin(a) * 50 }, color, 0.5);
      await this.wait(70);
    }
    await this.wait(150);
  }

  private async tornado(t: Pt, color: number) {
    const parts: Img[] = [];
    for (let i = 0; i < 18; i++) parts.push(this.scene.add.image(t.x, t.y, "vfx-streak").setTint(i % 3 ? color : 0xffffff).setBlendMode(ADD).setDepth(DEPTH).setScale(0.5, 1.2));
    const tw = { v: 0 };
    await this.tween({ targets: tw, v: 1, duration: 900, onUpdate: () => {
      parts.forEach((p, i) => {
        const h = (i / parts.length), a = tw.v * 18 + i * 1.3, r = 18 + h * 50;
        p.setPosition(t.x + Math.cos(a) * r, t.y + 40 - h * 110).setRotation(a + Math.PI / 2).setScale(0.35 + h * 0.4, 1).setAlpha(Math.sin(tw.v * Math.PI));
      });
    } });
    parts.forEach((p) => p.destroy());
    await this.burst(t, color, 0.9, 6);
  }

  private async rocks(t: Pt, count: number) {
    const rs = Array.from({ length: count }, async (_, i) => {
      await this.wait(i * 110);
      const r = this.scene.add.image(t.x + rnd(-40, 40), -30, "vfx-rock").setDepth(DEPTH).setScale(rnd(14, 22) / 10).setAngle(rnd(0, 360));
      const g = this.glow(r.x, r.y, 0xf8e8c0, 0.35, 0.4);
      await this.tween({ targets: [r, g], y: t.y + rnd(0, 20), angle: "+=180", duration: 340, ease: "Quad.easeIn" });
      this.shake(90, 0.008);
      void this.burst({ x: r.x, y: r.y }, 0xc8b090, 0.6, 6);
      await this.tween({ targets: [r, g], alpha: 0, duration: 200 });
      r.destroy(); g.destroy();
    });
    await Promise.all(rs);
  }

  private async quake(t: Pt) {
    await this.dimBg(true, 0.3);
    this.shake(700, 0.016);
    const g = this.scene.add.graphics().setDepth(DEPTH);
    g.lineStyle(4, 0x3a2818, 1);
    for (let k = 0; k < 5; k++) {
      let x = t.x, y = t.y + 50;
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 5; i++) { x += rnd(-30, 30); y += rnd(-6, 10); g.lineTo(x, y); }
      g.strokePath();
    }
    const dust = Array.from({ length: 16 }, async (_, i) => {
      const d = this.scene.add.image(t.x + rnd(-80, 80), t.y + 50, "vfx-glow").setTint(0xb89060).setDepth(DEPTH).setScale(0.25).setAlpha(0.8);
      await this.tween({ targets: d, y: d.y - rnd(30, 70), scale: 0.6, alpha: 0, duration: 700, delay: i * 25 });
      d.destroy();
    });
    await Promise.all(dust);
    g.destroy();
    await this.dimBg(false);
  }

  private async explosion(u: Pt) {
    await this.dimBg(true, 0.6);
    this.scene.cameras.main.flash(250, 255, 255, 255);
    this.shake(600, 0.02);
    await Promise.all([this.burst(u, 0xf8a040, 2.6, 20), this.flameRise(u, 1.8), this.burst({ x: 320, y: 150 }, 0xffffff, 3, 0)]);
    await this.dimBg(false);
  }

  private async eyes(user: Img, target: Img, color: number) {
    const c = this.center(user);
    const es = [-12, 12].map((dx) => this.glow(c.x + dx, c.y - 20, color, 0.15, 1));
    await Promise.all(es.map((e) => this.tween({ targets: e, scaleX: 0.5, scaleY: 0.12, duration: 160, yoyo: true, repeat: 1 })));
    es.forEach((e) => e.destroy());
    await this.tween({ targets: target, x: target.x + 4, duration: 40, yoyo: true, repeat: 5 });
  }

  private async shield(user: Img, color: number) {
    void this.magicCircle(user, color, 900);
    const c = this.center(user);
    const hex6 = this.scene.add.graphics().setDepth(DEPTH).setBlendMode(ADD).setPosition(c.x, c.y);
    hex6.lineStyle(4, color, 0.9);
    const pts = Array.from({ length: 6 }, (_, i) => new Phaser.Math.Vector2(Math.cos(i / 6 * Math.PI * 2) * 60, Math.sin(i / 6 * Math.PI * 2) * 60));
    hex6.strokePoints(pts, true);
    hex6.fillStyle(color, 0.15).fillPoints(pts, true);
    hex6.setScale(0.2);
    await this.tween({ targets: hex6, scale: 1, duration: 260, ease: "Back.easeOut" });
    // shine sweep
    const sh = this.scene.add.image(c.x - 70, c.y, "vfx-streak").setTint(0xffffff).setBlendMode(ADD).setDepth(DEPTH + 1).setAngle(-60).setScale(1, 3);
    await this.tween({ targets: sh, x: c.x + 70, alpha: 0, duration: 380 });
    sh.destroy();
    await this.tween({ targets: hex6, alpha: 0, duration: 280 });
    hex6.destroy();
  }

  private async statusGeneric(c: Ctx) {
    const self = !c.move.status && !c.move.confuse && !c.move.leechSeed && (c.move.stats?.every((s) => s.target === "self") ?? true);
    if (self) { await this.magicCircle(c.user, c.col, 900); return; }
    await this.dimBg(true, 0.3);
    await this.soundWaves(c.u, c.t, c.col, 3);
    await this.magicCircle(c.target, c.col, 700);
    await this.dimBg(false);
  }

  private async typeGeneric(c: Ctx) {
    const physical = categoryOf(c.move.type) === "physical";
    const big = c.move.power >= 80;
    if (big) await this.dimBg(true, 0.45);
    switch (c.move.type) {
      case "Fire": await this.signatures.ember(c); break;
      case "Water": await this.signatures.watergun(c); break;
      case "Grass": await this.signatures.razorleaf(c); break;
      case "Electric": await this.signatures.thundershock(c); break;
      case "Ice": {
        const orbParts = this.orb(c.u.x, c.u.y, 0x98e8ff, 1.2);
        await this.travel(orbParts, c.u, c.t, 380, 20, 0xc8f4ff);
        orbParts.forEach((o) => o.destroy());
        await this.burst(c.t, 0xa8f0ff, 1.4, 16);
        break;
      }
      case "Psychic": await this.signatures.confusion(c); break;
      case "Ghost": case "Dark": {
        const orbParts = this.orb(c.u.x, c.u.y, c.move.type === "Ghost" ? 0x8040d0 : 0x502878, 1.3);
        await this.travel(orbParts, c.u, c.t, 420, 30, 0x6030a0);
        orbParts.forEach((o) => o.destroy());
        await this.burst(c.t, 0x9050e0, 1.4, 14);
        break;
      }
      case "Dragon": {
        const f = this.scene.add.image(c.u.x, c.u.y, "vfx-flame").setTint(0x8060f8).setBlendMode(ADD).setDepth(DEPTH).setScale(1.4);
        const orbParts = this.orb(c.u.x, c.u.y, 0x7038f8, 1);
        await this.travel([f, ...orbParts], c.u, c.t, 400, 30, 0x9070ff);
        f.destroy(); orbParts.forEach((o) => o.destroy());
        await this.burst(c.t, 0x8060f8, 1.3, 12);
        break;
      }
      case "Poison": await this.needles(c.u, c.t, 0xc050e0, 2); break;
      case "Bug": await this.needles(c.u, c.t, 0xb8d030, 3); break;
      case "Flying": await this.tornado(c.t, 0xe8f4ff); break;
      case "Rock": await this.rocks(c.t, 4); break;
      case "Ground": await this.quake(c.t); break;
      case "Fighting": await this.signatures.doublekick(c); break;
      case "Steel": await this.signatures.metalclaw(c); break;
      default:
        if (physical) { await this.lunge(c.user, c.dir, 40); this.shake(); await this.burst(c.t, 0xffffff, big ? 1.5 : 1.1); }
        else await this.burst(c.t, c.col, 1.2);
    }
    if (big) await this.dimBg(false);
  }
}

interface Ctx { move: MoveData; col: number; u: Pt; t: Pt; user: Img; target: Img; dir: number }
