import Phaser from "phaser";
import ART from "./art/patterns.json";
import { ART_SCALE, CHARACTER_FRAMES, CHARACTER_PALETTES, paintPattern, validatePatterns, type Palette, type Pattern } from "./pixelArt";
import { drawPixelText, pixelTextWidth } from "./pixelFont";
import type { BuildingDef, CharacterLook } from "./types";

export const TILE_SIZE = 32;
const T = TILE_SIZE;

type Ctx = CanvasRenderingContext2D;
const PAL = ART.palettes as Record<string, Palette>;
const pat = (name: keyof typeof ART) => ART[name] as unknown as Pattern;

/** Neighbour bits for autotiling. */
export const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;

// 2×2 "art pixel" helper
const px = (ctx: Ctx, ox: number, oy: number, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(ox + x * ART_SCALE, oy + y * ART_SCALE, w * ART_SCALE, h * ART_SCALE);
};
const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/* ------------------------------------------------------------------ */
/* Ground painters (16×16 art drawn at 2×)                             */
/* ------------------------------------------------------------------ */

const GRASS = PAL.ground["."];

function paintGround(ctx: Ctx, ox: number, oy: number, alt: boolean) {
  ctx.fillStyle = GRASS;
  ctx.fillRect(ox, oy, T, T);
  paintPattern(ctx, pat(alt ? "groundAlt" : "ground"), PAL.ground, ox, oy);
}

function paintFlowers(ctx: Ctx, ox: number, oy: number, frame: number, pink: boolean) {
  paintGround(ctx, ox, oy, false);
  paintPattern(ctx, pat(frame ? "flower1" : "flower0"), pink ? PAL.flowerB : PAL.flowerA, ox, oy);
}

function paintMoss(ctx: Ctx, ox: number, oy: number, seed: number) {
  ctx.fillStyle = "#344b45"; ctx.fillRect(ox, oy, T, T);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(hash(seed, i) * 14) + 1, y = Math.floor(hash(seed, i + 20) * 14) + 1;
    px(ctx, ox, oy, x, y, i % 3 ? "#587b61" : "#789b70", 2 + i % 2, 1 + (i % 3));
    if (i % 3 === 0) px(ctx, ox, oy, x + 1, y + 1, "#b0d88c");
  }
  px(ctx, ox, oy, 2, 13, "#283d38", 12, 1);
  px(ctx, ox, oy, 4, 14, "#4e6f5b", 8, 1);
}

function paintTallGrass(ctx: Ctx, ox: number, oy: number) {
  ctx.fillStyle = GRASS;
  ctx.fillRect(ox, oy, T, T);
  paintPattern(ctx, pat("tallGrass"), PAL.tallGrass, ox, oy);
}

/** Generic edge renderer for "area" tiles (path, sand) bordering grass. */
function paintEdges(ctx: Ctx, ox: number, oy: number, m: number, edge: string, outside = GRASS) {
  if (!(m & N)) { px(ctx, ox, oy, 0, 0, outside, 16, 1); px(ctx, ox, oy, 0, 1, edge, 16, 1); }
  if (!(m & S)) { px(ctx, ox, oy, 0, 15, outside, 16, 1); px(ctx, ox, oy, 0, 14, edge, 16, 1); }
  if (!(m & W)) { px(ctx, ox, oy, 0, 0, outside, 1, 16); px(ctx, ox, oy, 1, 0, edge, 1, 16); }
  if (!(m & E)) { px(ctx, ox, oy, 15, 0, outside, 1, 16); px(ctx, ox, oy, 14, 0, edge, 1, 16); }
  // Rounded outer corners
  const outer = (cx: number, cy: number, dx: number, dy: number) => {
    px(ctx, ox, oy, cx, cy, outside); px(ctx, ox, oy, cx + dx, cy, outside); px(ctx, ox, oy, cx, cy + dy, outside);
    px(ctx, ox, oy, cx + dx, cy + dy, outside);
    px(ctx, ox, oy, cx + 2 * dx, cy + dy, edge); px(ctx, ox, oy, cx + dx, cy + 2 * dy, edge);
  };
  if (!(m & N) && !(m & W)) outer(0, 0, 1, 1);
  if (!(m & N) && !(m & E)) outer(15, 0, -1, 1);
  if (!(m & S) && !(m & W)) outer(0, 15, 1, -1);
  if (!(m & S) && !(m & E)) outer(15, 15, -1, -1);
  // Inner corners (diagonal neighbour missing)
  const inner = (cx: number, cy: number, dx: number, dy: number) => {
    px(ctx, ox, oy, cx, cy, outside); px(ctx, ox, oy, cx + dx, cy, edge); px(ctx, ox, oy, cx, cy + dy, edge);
  };
  if (m & N && m & W && !(m & NW)) inner(0, 0, 1, 1);
  if (m & N && m & E && !(m & NE)) inner(15, 0, -1, 1);
  if (m & S && m & W && !(m & SW)) inner(0, 15, 1, -1);
  if (m & S && m & E && !(m & SE)) inner(15, 15, -1, -1);
}

function paintPath(ctx: Ctx, ox: number, oy: number, m: number, seed: number) {
  ctx.fillStyle = "#e6cc90";
  ctx.fillRect(ox, oy, T, T);
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(hash(seed, i) * 12), y = 2 + Math.floor(hash(seed, i + 9) * 12);
    px(ctx, ox, oy, x, y, i % 2 ? "#d2b274" : "#f2e0b0");
    if (i % 2) px(ctx, ox, oy, x + 1, y, "#d2b274");
  }
  paintEdges(ctx, ox, oy, m, "#b8945c");
}

function paintSand(ctx: Ctx, ox: number, oy: number, m: number, seed: number) {
  ctx.fillStyle = "#f2e2aa";
  ctx.fillRect(ox, oy, T, T);
  for (let i = 0; i < 6; i++) px(ctx, ox, oy, 2 + Math.floor(hash(seed, i) * 12), 2 + Math.floor(hash(seed, i + 4) * 12), i % 2 ? "#dcc488" : "#fff6d0");
  paintEdges(ctx, ox, oy, m, "#d4bc80");
}

/** Water with 3 animation frames; shoreline foam where land touches. */
function paintWater(ctx: Ctx, ox: number, oy: number, m: number, frame: number, seed: number) {
  ctx.fillStyle = "#68a8f0";
  ctx.fillRect(ox, oy, T, T);
  const waves = [[2, 3], [9, 7], [4, 11], [11, 13]];
  waves.forEach(([wx, wy], i) => {
    const x = (wx + frame * 2 + Math.floor(hash(seed, i) * 3)) % 14;
    px(ctx, ox, oy, x, wy, "#98c8f8", 3, 1);
    px(ctx, ox, oy, x + 1, wy - 1, "#c8e4ff", 1, 1);
  });
  if ((seed + frame) % 3 === 0) px(ctx, ox, oy, 6 + frame, 5, "#ffffff");
  const foam = "#f0faff", lip = "#a8d4f8";
  if (!(m & N)) { px(ctx, ox, oy, 0, 0, foam, 16, 1); px(ctx, ox, oy, 0, 1, lip, 16, 1); }
  if (!(m & S)) { px(ctx, ox, oy, 0, 15, "#4a88d0", 16, 1); }
  if (!(m & W)) { px(ctx, ox, oy, 0, 0, foam, 1, 16); px(ctx, ox, oy, 1, 0, lip, 1, 16); }
  if (!(m & E)) { px(ctx, ox, oy, 15, 0, foam, 1, 16); px(ctx, ox, oy, 14, 0, lip, 1, 16); }
}

/** Rocky cliff face: staggered stone blocks with highlights, grassy lip on top. */
function paintCliff(ctx: Ctx, ox: number, oy: number, m: number, seed: number) {
  ctx.fillStyle = "#8c7c6c";
  ctx.fillRect(ox, oy, T, T);
  const rows = [[0, 5], [5, 5], [10, 6]];
  rows.forEach(([y0, h], r) => {
    const off = (r + seed) % 2 ? 4 : 0;
    for (let x0 = -off; x0 < 16; x0 += 8) {
      const x = Math.max(0, x0), w = Math.min(16, x0 + 8) - x;
      if (w <= 1) continue;
      px(ctx, ox, oy, x, y0, "#b4a08a", w - 1, h - 1);
      px(ctx, ox, oy, x, y0, "#d0bea4", w - 1, 1);
      px(ctx, ox, oy, x, y0, "#c8b498", 1, h - 1);
      px(ctx, ox, oy, x, y0 + h - 2, "#9c8a74", w - 1, 1);
    }
  });
  if (!(m & N)) { px(ctx, ox, oy, 0, 0, "#5a9a40", 16, 2); px(ctx, ox, oy, 0, 2, "#3c6e2c", 16, 1); }
  if (!(m & W)) px(ctx, ox, oy, 0, 0, "#5c4c40", 1, 16);
  if (!(m & E)) px(ctx, ox, oy, 15, 0, "#5c4c40", 1, 16);
  if (!(m & S)) { px(ctx, ox, oy, 0, 15, "#5c4c40", 16, 1); }
}

function paintPatternTile(ctx: Ctx, ox: number, oy: number, name: "crops" | "cabbage" | "bridge") {
  const palette = PAL[name];
  ctx.fillStyle = palette["."] ?? "#68a8f0";
  ctx.fillRect(ox, oy, T, T);
  paintPattern(ctx, pat(name), palette, ox, oy);
}

export type GroundPainter = (ctx: Ctx, ox: number, oy: number) => void;

/** Descriptor → painter. Descriptors are produced by WorldMap from the layout. */
export function painterFor(desc: string): GroundPainter {
  const [kind, a = "0", b = "0", c = "0"] = desc.split(":");
  const n1 = Number(a), n2 = Number(b), n3 = Number(c);
  switch (kind) {
    case "ground": return (ctx, x, y) => paintGround(ctx, x, y, n1 === 1);
    case "flower": return (ctx, x, y) => paintFlowers(ctx, x, y, n1, n2 === 1);
    case "tall": return (ctx, x, y) => paintTallGrass(ctx, x, y);
    case "moss": return (ctx, x, y) => paintMoss(ctx, x, y, n1);
    case "path": return (ctx, x, y) => paintPath(ctx, x, y, n1, n2);
    case "sand": return (ctx, x, y) => paintSand(ctx, x, y, n1, n2);
    case "water": return (ctx, x, y) => paintWater(ctx, x, y, n1, n2, n3);
    case "cliff": return (ctx, x, y) => paintCliff(ctx, x, y, n1, n2);
    case "crops": return (ctx, x, y) => paintPatternTile(ctx, x, y, "crops");
    case "cabbage": return (ctx, x, y) => paintPatternTile(ctx, x, y, "cabbage");
    case "bridge": return (ctx, x, y) => paintPatternTile(ctx, x, y, "bridge");
    default: return (ctx, x, y) => paintGround(ctx, x, y, false);
  }
}

/** Packs every distinct ground descriptor into one canvas texture for a Phaser tileset. */
export function buildAtlas(scene: Phaser.Scene, key: string, descriptors: string[]): Map<string, number> {
  const cols = 32, rows = Math.max(1, Math.ceil(descriptors.length / cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols * T;
  canvas.height = rows * T;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const index = new Map<string, number>();
  descriptors.forEach((d, i) => {
    painterFor(d)(ctx, (i % cols) * T, Math.floor(i / cols) * T);
    index.set(d, i);
  });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return index;
}

/* ------------------------------------------------------------------ */
/* Props (y-sorted images)                                             */
/* ------------------------------------------------------------------ */

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) return key;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  scene.textures.addCanvas(key, c);
  return key;
}

export const PROP = {
  tree: "prop-tree", apple: "prop-apple", rock: "prop-rock", sign: "prop-sign", fence: "prop-fence", hedge: "prop-hedge",
  well: "prop-well", bench: "prop-bench", mailbox: "prop-mailbox", lamp: "prop-lamp", itemBall: "prop-item",
  grassFront: "prop-grass-front", shadow: "prop-shadow", leaf: "fx-leaf", bubble: "fx-bubble", blades: "prop-blades", crystal: "prop-moon-crystal", firefly: "prop-firefly",
} as const;

export function ensurePropTextures(scene: Phaser.Scene) {
  validatePatterns();
  canvasTexture(scene, PROP.tree, T, T * 2, (ctx) => paintPattern(ctx, pat("tree"), PAL.tree, 0, 0));
  canvasTexture(scene, PROP.apple, T, T * 2, (ctx) => { paintPattern(ctx, pat("tree"), PAL.tree, 0, 0); paintPattern(ctx, pat("fruit"), PAL.fruit, 0, 0); });
  canvasTexture(scene, PROP.rock, T, T, (ctx) => paintPattern(ctx, pat("rock"), PAL.rock, 0, 0));
  canvasTexture(scene, PROP.hedge, T, T, (ctx) => paintPattern(ctx, pat("hedge"), PAL.hedge, 0, 0));
  canvasTexture(scene, PROP.well, T, T, (ctx) => paintPattern(ctx, pat("well"), PAL.well, 0, 0));
  canvasTexture(scene, PROP.bench, T, T, (ctx) => paintPattern(ctx, pat("bench"), PAL.bench, 0, 0));
  canvasTexture(scene, PROP.mailbox, T, T, (ctx) => paintPattern(ctx, pat("mailbox"), PAL.mailbox, 0, 0));
  canvasTexture(scene, PROP.lamp, T, T, (ctx) => paintPattern(ctx, pat("lamp"), PAL.lamp, 0, 0));
  canvasTexture(scene, PROP.itemBall, T, T, (ctx) => {
    ctx.fillStyle = "rgba(20,50,25,0.3)"; ctx.beginPath(); ctx.ellipse(16, 26, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#202028"; ctx.beginPath(); ctx.arc(16, 17, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f8f8f8"; ctx.beginPath(); ctx.arc(16, 17, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e04040"; ctx.beginPath(); ctx.arc(16, 17, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#202028"; ctx.fillRect(9, 16, 14, 2);
    ctx.fillStyle = "#f8f8f8"; ctx.fillRect(14, 15, 4, 4); ctx.fillStyle = "#ffb0b0"; ctx.fillRect(11, 12, 3, 2);
  });
  canvasTexture(scene, PROP.bubble, 20, 22, (ctx) => {
    ctx.fillStyle = "#303040"; ctx.fillRect(0, 0, 20, 18); ctx.fillRect(6, 18, 6, 4);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(2, 2, 16, 14); ctx.fillRect(8, 16, 2, 3);
    ctx.fillStyle = "#e03838"; ctx.fillRect(8, 4, 4, 7); ctx.fillRect(8, 12, 4, 3);
  });
  canvasTexture(scene, PROP.blades, 84, 84, (ctx) => {
    ctx.translate(42, 42);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#4a2c18"; ctx.fillRect(-3, -40, 6, 40);
      ctx.fillStyle = "#f4ead0"; ctx.fillRect(3, -38, 12, 30);
      ctx.fillStyle = "#c8b890"; ctx.fillRect(3, -38, 12, 2); ctx.fillRect(3, -28, 12, 2); ctx.fillRect(3, -18, 12, 2);
      ctx.fillStyle = "#4a2c18"; ctx.fillRect(14, -38, 2, 30);
      ctx.rotate(Math.PI / 2);
    }
    ctx.fillStyle = "#3a2418"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c89058"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  });
  canvasTexture(scene, PROP.sign, T, T, (ctx) => paintPattern(ctx, pat("sign"), PAL.sign, 0, 0));
  canvasTexture(scene, PROP.fence, T, T, (ctx) => paintPattern(ctx, pat("fence"), PAL.fence, 0, 0));
  canvasTexture(scene, PROP.grassFront, T, T, (ctx) => paintPattern(ctx, pat("tallGrassFront"), { ...PAL.tallGrass, ".": "" }, 0, 0));
  canvasTexture(scene, PROP.shadow, 24, 8, (ctx) => {
    ctx.fillStyle = "rgba(20,50,25,0.30)";
    ctx.beginPath(); ctx.ellipse(12, 4, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  });
  canvasTexture(scene, PROP.leaf, 6, 6, (ctx) => {
    ctx.fillStyle = "#4c9c3c"; ctx.fillRect(2, 0, 2, 6); ctx.fillRect(0, 2, 6, 2);
    ctx.fillStyle = "#a8e480"; ctx.fillRect(2, 2, 2, 2);
  });
}

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* ------------------------------------------------------------------ */

const shade = (hex: number, amt: number) => {
  const c = Phaser.Display.Color.IntegerToColor(hex);
  return (amt < 0 ? c.darken(-amt) : c.lighten(amt)).rgba;
};
const css = (n: number) => "#" + n.toString(16).padStart(6, "0");

export const BUILDING_OVERHANG = 10; // roof pixels above the footprint
export const BUILDING_SHADOW = 6;

/** FireRed-style house: shingled roof with ridge and eaves, plank walls, framed windows, door, optional plaque/chimney. */
export function ensureBuildingTexture(scene: Phaser.Scene, b: BuildingDef) {
  if (b.style === "windmill") return ensureWindmillTexture(scene, b);
  const key = `bld-${b.id}`;
  const W = b.w * T, H = b.h * T + BUILDING_OVERHANG + BUILDING_SHADOW;
  return canvasTexture(scene, key, W, H, (ctx) => {
    const top = 0, roofBottom = BUILDING_OVERHANG + 2 * T + 6, wallBottom = BUILDING_OVERHANG + b.h * T;
    const k = "#2c2430";
    // ground shadow under the wall
    ctx.fillStyle = "rgba(20,50,25,0.28)";
    ctx.fillRect(6, wallBottom - 2, W - 6, BUILDING_SHADOW + 2);

    // walls
    ctx.fillStyle = k; ctx.fillRect(4, roofBottom - 6, W - 8, wallBottom - roofBottom + 6);
    ctx.fillStyle = css(b.wall); ctx.fillRect(6, roofBottom - 6, W - 12, wallBottom - roofBottom + 4);
    ctx.fillStyle = shade(b.wall, -12);
    for (let x = 6; x < W - 6; x += 8) ctx.fillRect(x, roofBottom, 2, wallBottom - roofBottom - 4);
    ctx.fillStyle = shade(b.wall, -28); ctx.fillRect(6, wallBottom - 6, W - 12, 4);
    ctx.fillStyle = shade(b.wall, 10); ctx.fillRect(6, roofBottom - 6, W - 12, 2);

    // roof: outline, body, shingle rows, ridge highlight, dark eave
    ctx.fillStyle = k; ctx.fillRect(0, top + 2, W, roofBottom - top - 2);
    ctx.fillStyle = css(b.roof); ctx.fillRect(2, top + 4, W - 4, roofBottom - top - 8);
    for (let y = top + 12, row = 0; y < roofBottom - 8; y += 8, row++) {
      ctx.fillStyle = shade(b.roof, -18); ctx.fillRect(2, y, W - 4, 2);
      ctx.fillStyle = shade(b.roof, -10);
      for (let x = 2 + (row % 2) * 8; x < W - 4; x += 16) ctx.fillRect(x, y - 6, 2, 6);
    }
    ctx.fillStyle = shade(b.roof, 22); ctx.fillRect(2, top + 4, W - 4, 4);
    ctx.fillStyle = shade(b.roof, 40); ctx.fillRect(6, top + 4, W - 12, 2);
    ctx.fillStyle = shade(b.roof, -35); ctx.fillRect(2, roofBottom - 8, W - 4, 4);
    ctx.fillStyle = k; ctx.fillRect(0, roofBottom - 4, W, 2);

    if (b.chimney) {
      const cx = W - 40;
      ctx.fillStyle = k; ctx.fillRect(cx - 2, top - 0, 16, 20);
      ctx.fillStyle = "#b86048"; ctx.fillRect(cx, top + 2, 12, 16);
      ctx.fillStyle = "#8c4434"; ctx.fillRect(cx, top + 8, 12, 2); ctx.fillRect(cx, top + 14, 12, 2);
      ctx.fillStyle = "#d88068"; ctx.fillRect(cx, top + 2, 12, 2);
    }

    // windows (every other column, skipping door & edges)
    const wy = roofBottom + 4;
    for (let tx = 1; tx < b.w - 1; tx++) {
      if (b.x + tx === b.door.x || Math.abs(b.x + tx - b.door.x) === 0) continue;
      if ((tx % 2) === (b.door.x - b.x) % 2) continue;
      const wx = tx * T + 5;
      ctx.fillStyle = k; ctx.fillRect(wx - 2, wy - 2, 26, 20);
      ctx.fillStyle = "#f4ecd8"; ctx.fillRect(wx, wy, 22, 16);
      ctx.fillStyle = "#6cb0e8"; ctx.fillRect(wx + 2, wy + 2, 18, 12);
      ctx.fillStyle = "#a8d8ff"; ctx.fillRect(wx + 2, wy + 2, 8, 5);
      ctx.fillStyle = "#f4ecd8"; ctx.fillRect(wx + 10, wy + 2, 2, 12); ctx.fillRect(wx + 2, wy + 7, 18, 2);
      ctx.fillStyle = shade(b.wall, -30); ctx.fillRect(wx - 2, wy + 18, 26, 2);
    }

    // door
    const dx = (b.door.x - b.x) * T, dTop = wallBottom - 30;
    ctx.fillStyle = k; ctx.fillRect(dx + 4, dTop, 24, 30);
    ctx.fillStyle = "#9a6438"; ctx.fillRect(dx + 6, dTop + 2, 20, 26);
    ctx.fillStyle = "#7a4a28"; ctx.fillRect(dx + 15, dTop + 2, 2, 26);
    ctx.fillStyle = "#b8804c"; ctx.fillRect(dx + 6, dTop + 2, 20, 2);
    ctx.fillStyle = "#f8d870"; ctx.fillRect(dx + 21, dTop + 15, 2, 3);
    ctx.fillStyle = "#c8b8a0"; ctx.fillRect(dx + 2, wallBottom - 2, 28, 2);

    // plaque above the door area
    if (b.plaque) {
      const tw = pixelTextWidth(b.plaque, 2);
      const pw = tw + 14, pxl = Math.round(W / 2 - pw / 2), py = roofBottom - 22;
      ctx.fillStyle = k; ctx.fillRect(pxl - 2, py - 2, pw + 4, 22);
      ctx.fillStyle = "#f8f0d8"; ctx.fillRect(pxl, py, pw, 18);
      ctx.fillStyle = shade(b.roof, -10); ctx.fillRect(pxl, py + 16, pw, 2);
      drawPixelText(ctx, b.plaque, pxl + 7, py + 2, css(Phaser.Display.Color.IntegerToColor(b.roof).darken(30).color), 2);
    }
  });
}

/** Windmill tower (blades are a separate rotating sprite, see PROP.blades). */
export const WINDMILL_OVERHANG = 40;
function ensureWindmillTexture(scene: Phaser.Scene, b: BuildingDef) {
  const key = `bld-${b.id}`;
  const Wd = b.w * T, Ht = b.h * T + WINDMILL_OVERHANG + BUILDING_SHADOW;
  return canvasTexture(scene, key, Wd, Ht, (ctx) => {
    const base = WINDMILL_OVERHANG + b.h * T, k = "#2c2430";
    ctx.fillStyle = "rgba(20,50,25,0.28)"; ctx.fillRect(6, base - 2, Wd - 4, BUILDING_SHADOW + 2);
    // tapered stone/plaster tower
    const topY = 26, topInset = 18;
    ctx.fillStyle = k;
    ctx.beginPath(); ctx.moveTo(topInset - 2, topY); ctx.lineTo(Wd - topInset + 2, topY); ctx.lineTo(Wd - 2, base); ctx.lineTo(2, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f0e4cc";
    ctx.beginPath(); ctx.moveTo(topInset, topY + 2); ctx.lineTo(Wd - topInset, topY + 2); ctx.lineTo(Wd - 4, base - 2); ctx.lineTo(4, base - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d8c8a8";
    for (let y = topY + 14; y < base - 6; y += 12) ctx.fillRect(10, y, Wd - 20, 2);
    ctx.fillStyle = "#c8b490"; ctx.fillRect(Wd - 22, topY + 6, 6, base - topY - 12);
    // conical roof
    ctx.fillStyle = k;
    ctx.beginPath(); ctx.moveTo(Wd / 2, 0); ctx.lineTo(Wd - 8, topY + 4); ctx.lineTo(8, topY + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b85040";
    ctx.beginPath(); ctx.moveTo(Wd / 2, 4); ctx.lineTo(Wd - 12, topY + 1); ctx.lineTo(12, topY + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d87060"; ctx.beginPath(); ctx.moveTo(Wd / 2, 4); ctx.lineTo(Wd / 2 - 10, topY + 1); ctx.lineTo(Wd / 2 - 2, topY + 1); ctx.closePath(); ctx.fill();
    // round window + door
    ctx.fillStyle = k; ctx.beginPath(); ctx.arc(Wd / 2, topY + 34, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6cb0e8"; ctx.beginPath(); ctx.arc(Wd / 2, topY + 34, 6, 0, Math.PI * 2); ctx.fill();
    const dx = (b.door.x - b.x) * T, dTop = base - 30;
    ctx.fillStyle = k; ctx.fillRect(dx + 5, dTop, 22, 30);
    ctx.fillStyle = "#8a5a30"; ctx.beginPath(); ctx.moveTo(dx + 7, dTop + 30); ctx.lineTo(dx + 7, dTop + 10); ctx.arc(dx + 16, dTop + 10, 9, Math.PI, 0); ctx.lineTo(dx + 25, dTop + 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f8d870"; ctx.fillRect(dx + 20, dTop + 17, 2, 3);
  });
}

/* ------------------------------------------------------------------ */
/* Characters                                                          */
/* ------------------------------------------------------------------ */

export const characterTextureKey = (look: CharacterLook) => `char-${look}`;
export const CHAR_FRAME = { down: 0, up: 3, left: 6 } as const;

/** Character sheet: 9 frames (down/up/left × stand/walkA/walkB), each 32×32. */
export function ensureCharacterTexture(scene: Phaser.Scene, look: CharacterLook) {
  const key = characterTextureKey(look);
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement("canvas");
  canvas.width = CHARACTER_FRAMES.length * T;
  canvas.height = T;
  const ctx = canvas.getContext("2d")!;
  CHARACTER_FRAMES.forEach((f, i) => paintPattern(ctx, f.pattern, CHARACTER_PALETTES[look], i * T, 0));
  const tex = scene.textures.addCanvas(key, canvas)!;
  CHARACTER_FRAMES.forEach((_, i) => tex.add(i, 0, i * T, 0, T, T));
  return key;
}
