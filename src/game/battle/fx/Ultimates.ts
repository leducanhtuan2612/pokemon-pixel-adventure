import Phaser from "phaser";
import type { MoveData } from "../../data/moves";
import { ELEMENT_INFO, type Element } from "../elements";
import { BEHIND, type Fx3D, type Pt } from "./Fx3D";

type Img = Phaser.GameObjects.Image;
const ADD = Phaser.BlendModes.ADD;
const rnd = Phaser.Math.FloatBetween;

export interface UltCtx { move: MoveData; u: Pt; t: Pt; user: Img; target: Img; dir: number }

/**
 * Ultimate (Tuyệt kỹ) cinematics. Shared shot list:
 *   letterbox + bloom → close-up on the user with focus lines → 3D title card
 *   → element-specific charge → wide shot release → close-up impact → reset.
 */
export async function playUltimate(x: Fx3D, scene: Phaser.Scene, c: UltCtx, el: Element | "none") {
  const color = el === "none" ? 0xffe0a0 : ELEMENT_INFO[el].color;
  const floorU = { x: c.user.x, y: c.user.y - 4 }, floorT = { x: c.target.x, y: c.target.y - 4 };
  const mid = { x: (c.u.x + c.t.x) / 2, y: (c.u.y + c.t.y) / 2 };

  await x.letterbox(true);
  x.bloom(true, 1.5);
  const stopLines = x.radialLines(c.u, color);
  const stopSigil = x.sigil(floorU, color, Math.max(1, c.user.displayWidth / 120));
  await x.focus(c.u, 1.45, 360);
  await x.titleCard(c.move.name, color);

  // Charge: element aura converging on the user.
  const charged = await x.charge(c.u, color, 620);
  await stopLines();
  await x.focus(mid, 1.08, 260);

  switch (el) {
    case "fire": {
      // Dragon-spiral of flame wrapping a flamethrower, then a five-arm detonation.
      await Promise.all([x.flameStream(c.u, c.t, 1000, 1.7), x.helix(c.u, c.t, 0xff8a2a, 1000, 3, 22, 50, "fx3-puff")]);
      await x.focus(c.t, 1.35, 160);
      await Promise.all([x.fireStar(c.t, 1.7), x.groundWave(floorT, 0xff5a1a, 1.4), x.pillar(c.t, 0xff7a2a, floorT.y, 60, 600)]);
      break;
    }
    case "water": {
      // Primal tide: orbiting orbs fire curved beams while a cone of water roars through.
      const orbs = await x.orbit(c.u, 6, color, 700, 90, 26);
      await Promise.all([x.homingBeams(orbs, c.t, color, 460), x.coneBeam(c.u, c.t, color, { w0: 20, w1: 120, ms: 760, rings: 4 })]);
      await x.focus(c.t, 1.35, 160);
      await x.groundWave(floorT, color, 1.6);
      break;
    }
    case "volt": {
      // Sky barrage: bolts rain from above, then a lightning cone.
      await Promise.all(Array.from({ length: 9 }, (_, i) => x.wait(i * 70).then(() => bolt(scene, { x: c.t.x + rnd(-70, 70), y: -10 }, { x: c.t.x + rnd(-24, 24), y: c.t.y + rnd(-10, 30) }, color))));
      await x.coneBeam(c.u, c.t, color, { w0: 14, w1: 90, ms: 620, rings: 6 });
      await x.focus(c.t, 1.4, 140);
      await x.groundWave(floorT, color, 1.3);
      break;
    }
    case "wood": {
      // World tree: green helix of leaves and a pillar of life through the target.
      await Promise.all([x.helix(c.u, c.t, color, 900, 3, 24, 46, "vfx-leaf"), x.coneBeam(c.u, c.t, color, { w0: 16, w1: 80, ms: 760, rings: 3 })]);
      await x.focus(c.t, 1.35, 160);
      await Promise.all([x.pillar(c.t, color, floorT.y, 80, 700), x.groundWave(floorT, color, 1.3)]);
      break;
    }
    case "wind": {
      // Heaven-splitting slash: giant crescents cross the target, wrapped by a cyclone.
      await x.helix({ x: c.t.x, y: floorT.y }, { x: c.t.x, y: c.t.y - 120 }, color, 700, 3, 26, 60);
      await x.focus(c.t, 1.35, 140);
      await Promise.all([0, 1, 2].map((i) => x.wait(i * 110).then(() => crescent(scene, x, c.t, color, i % 2 ? 40 : 140))));
      await x.groundWave(floorT, color, 1.2);
      break;
    }
    case "earth": {
      // Dragon vein: three advancing shockwaves, erupting pillar and flying boulders.
      for (let i = 0; i < 3; i++) await x.groundWave({ x: Phaser.Math.Linear(floorU.x, floorT.x, (i + 1) / 3), y: Phaser.Math.Linear(floorU.y, floorT.y, (i + 1) / 3) }, color, 0.8 + i * 0.3, 300);
      await x.focus(c.t, 1.35, 140);
      await Promise.all([x.pillar(c.t, 0xffc070, floorT.y, 70, 560), x.debris({ x: c.t.x, y: floorT.y - 20 }, 14, 0xffffff, "fx3-rock", floorT.y)]);
      break;
    }
    case "frost": {
      await x.coneBeam(c.u, c.t, color, { w0: 16, w1: 110, ms: 760, rings: 5 });
      await x.focus(c.t, 1.35, 160);
      await Promise.all([x.iceCrystals(c.t, 18, floorT.y), x.groundWave(floorT, 0xdff8ff, 1.4)]);
      break;
    }
    case "mystic": {
      // Void of stars: space warps, a violet cone with perpendicular time-rings.
      void x.warp(1.18, 900);
      await x.coneBeam(c.u, c.t, color, { w0: 24, w1: 150, ms: 900, rings: 8, core: 0xf0e0ff });
      await x.focus(c.t, 1.35, 160);
      await x.groundWave(floorT, color, 1.6);
      break;
    }
    case "toxin": {
      await Promise.all([x.helix(c.u, c.t, color, 900, 2, 26, 40, "vfx-bubble"), cloud(scene, x, c.t, color)]);
      await x.focus(c.t, 1.35, 160);
      await x.groundWave(floorT, color, 1.3);
      break;
    }
    default: {
      // Sky-breaker fist: a golden chi cone, then an afterimage dash and a chain of shockwave rings.
      await x.coneBeam(c.u, c.t, 0xffd070, { w0: 30, w1: 90, ms: 520, rings: 6, helix: false });
      for (let i = 0; i < 5; i++) {
        await x.tween({ targets: c.user, x: c.user.x + 30 * c.dir, duration: 60, yoyo: true });
        void x.perspRing(c.t, c.dir > 0 ? 0 : Math.PI, 0xffffff, 1.2, 360);
        x.punch(0.6);
      }
      await x.focus(c.t, 1.35, 140);
      await Promise.all([x.groundWave(floorT, color, 1.5), x.debris({ x: c.t.x, y: floorT.y - 20 }, 10, 0xffffff, "fx3-rock", floorT.y)]);
    }
  }

  // Shared impact: white-out, hit-stop punch, target recoil.
  x.flash(200);
  x.punch(1.6);
  c.target.setTintFill(0xffffff);
  await x.tween({ targets: c.target, x: c.target.x + 18 * c.dir, duration: 70, yoyo: true, repeat: 2 });
  c.target.clearTint();
  charged.forEach((o) => o.destroy());
  await stopSigil();
  await x.resetCam(360);
  x.bloom(false);
  await x.letterbox(false);
}

function bolt(scene: Phaser.Scene, from: Pt, to: Pt, color: number) {
  const g = scene.add.graphics().setDepth(40).setBlendMode(ADD);
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new Phaser.Math.Vector2(Phaser.Math.Linear(from.x, to.x, t) + (i && i < 10 ? rnd(-18, 18) : 0), Phaser.Math.Linear(from.y, to.y, t)));
  }
  g.lineStyle(22, color, 0.25).strokePoints(pts);
  g.lineStyle(9, color, 0.8).strokePoints(pts);
  g.lineStyle(3, 0xffffff, 1).strokePoints(pts);
  scene.cameras.main.flash(50, 255, 250, 200, true);
  return new Promise<void>((r) => scene.tweens.add({ targets: g, alpha: 0, duration: 200, delay: 60, onComplete: () => { g.destroy(); r(); } }));
}

async function crescent(scene: Phaser.Scene, x: Fx3D, t: Pt, color: number, angle: number) {
  const c = scene.add.image(t.x, t.y, "vfx-slash").setTint(color).setBlendMode(ADD).setDepth(40).setAngle(angle).setScale(0.6, 1.4);
  const w = scene.add.image(t.x, t.y, "vfx-slash").setTint(0xffffff).setBlendMode(ADD).setDepth(41).setAngle(angle).setScale(0.4, 0.9);
  x.punch(0.7);
  await x.tween({ targets: [c, w], scaleX: 3.4, alpha: 0, duration: 340, ease: "Cubic.easeOut" });
  c.destroy(); w.destroy();
}

async function cloud(scene: Phaser.Scene, x: Fx3D, t: Pt, color: number) {
  await Promise.all(Array.from({ length: 18 }, (_, i) => {
    const p = scene.add.image(t.x + rnd(-60, 60), t.y + rnd(-30, 40), "fx3-puff").setTint(color).setAlpha(0).setDepth(i % 2 ? BEHIND : 36).setScale(0.4);
    return x.wait(i * 30).then(() => x.tween({ targets: p, alpha: 0.75, scale: rnd(1.2, 2), y: p.y - rnd(10, 40), duration: 700, yoyo: true })).then(() => p.destroy());
  }));
}
