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

/** Rich grass base: subtle tonal patches, blades, clover and a warm sunlit edge.
 * Seeded per logical tile so the landscape is detailed but stable between loads. */
function paintGround(ctx: Ctx, ox: number, oy: number, alt: boolean, seed = 0) {
  const base = alt ? "#91ca67" : GRASS;
  ctx.fillStyle = base;
  ctx.fillRect(ox, oy, T, T);
  paintPattern(ctx, pat(alt ? "groundAlt" : "ground"), PAL.ground, ox, oy);
  // Soft pixel clusters break the repeated 16px pattern into natural-looking ground.
  for (let i = 0; i < 13; i++) {
    const x = 1 + Math.floor(hash(seed + 7, i) * 14);
    const y = 1 + Math.floor(hash(seed + 29, i) * 14);
    const tone = i % 4 === 0 ? "#c2e99a" : i % 3 === 0 ? "#79bd55" : "#a5dc78";
    px(ctx, ox, oy, x, y, tone, i % 5 === 0 ? 2 : 1, i % 6 === 0 ? 2 : 1);
    if (i % 4 === 0) px(ctx, ox, oy, x, y + 1, "#5d9f45");
  }
  // Tiny directional light and contact shading give each diamond a readable edge.
  px(ctx, ox, oy, 0, 0, "rgba(238,255,206,0.20)", 16, 1);
  px(ctx, ox, oy, 0, 15, "rgba(38,83,43,0.14)", 16, 1);
}

function paintFlowers(ctx: Ctx, ox: number, oy: number, frame: number, pink: boolean, seed = 0) {
  paintGround(ctx, ox, oy, false, seed);
  paintPattern(ctx, pat(frame ? "flower1" : "flower0"), pink ? PAL.flowerB : PAL.flowerA, ox, oy);
  // A few scattered petals and leaf highlights add volume without enlarging the tile.
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(hash(seed + 101, i) * 12);
    const y = 2 + Math.floor(hash(seed + 117, i) * 12);
    px(ctx, ox, oy, x, y, pink ? "#ffd1e1" : "#fff8d0");
  }
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

function paintTallGrass(ctx: Ctx, ox: number, oy: number, frame = 0, seed = 0) {
  paintGround(ctx, ox, oy, seed % 7 === 0, seed);
  paintPattern(ctx, pat("tallGrass"), PAL.tallGrass, ox, oy);
  // Tiny alternating highlights suggest a breeze without breaking tile seams.
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(hash(seed + frame * 19, i) * 12);
    const y = 1 + Math.floor(hash(seed + frame * 31, i + 8) * 5);
    px(ctx, ox, oy, x, y, frame === 0 ? "#b8ed8c" : "#4f9e45");
  }
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
  ctx.fillStyle = "#d8b77c";
  ctx.fillRect(ox, oy, T, T);
  // Warm packed earth with a slightly darker center and soft grass-frayed borders.
  for (let i = 0; i < 20; i++) {
    const x = 1 + Math.floor(hash(seed + 211, i) * 14), y = 1 + Math.floor(hash(seed + 233, i) * 14);
    const color = i % 5 === 0 ? "#f4dfac" : i % 3 === 0 ? "#b88b55" : "#e7c994";
    px(ctx, ox, oy, x, y, color, i % 4 === 0 ? 2 : 1, 1);
  }
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(hash(seed, i) * 12), y = 2 + Math.floor(hash(seed, i + 9) * 12);
    px(ctx, ox, oy, x, y, i % 2 ? "#c49b63" : "#f2e0b0", i % 2 ? 2 : 1, 1);
  }
  paintEdges(ctx, ox, oy, m, "#a98551");
  if (!(m & N)) px(ctx, ox, oy, 2, 2, "#82bf59", 12, 1);
  if (!(m & S)) px(ctx, ox, oy, 2, 13, "#82bf59", 12, 1);
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
    case "ground": return (ctx, x, y) => paintGround(ctx, x, y, n1 === 1, n2);
    case "flower": return (ctx, x, y) => paintFlowers(ctx, x, y, n1, n2 === 1, n3);
    case "tall": return (ctx, x, y) => paintTallGrass(ctx, x, y, n1, n2);
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
export const ISO_TILE_W = TILE_SIZE;
export const ISO_TILE_H = TILE_SIZE;

/** Build a crisp square atlas for the classic orthogonal top-down world. */
export function buildAtlas(scene: Phaser.Scene, key: string, descriptors: string[]): Map<string, number> {
  const cols = 32, rows = Math.max(1, Math.ceil(descriptors.length / cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols * ISO_TILE_W;
  canvas.height = rows * ISO_TILE_H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const index = new Map<string, number>();
  descriptors.forEach((d, i) => {
    const source = document.createElement("canvas");
    source.width = T; source.height = T;
    const painter = source.getContext("2d")!;
    painter.imageSmoothingEnabled = false;
    painterFor(d)(painter, 0, 0);
    const x = (i % cols) * ISO_TILE_W, y = Math.floor(i / cols) * ISO_TILE_H;
    ctx.drawImage(source, x, y, ISO_TILE_W, ISO_TILE_H);
    index.set(d, i);
  });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.addCanvas(key, canvas);
  if (!texture) throw new Error(`Failed to create top-down atlas: ${key}`);
  descriptors.forEach((_, i) => texture.add(String(i), 0, (i % cols) * ISO_TILE_W, Math.floor(i / cols) * ISO_TILE_H, ISO_TILE_W, ISO_TILE_H));
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
  tree: "prop-tree", treeAlt: "prop-tree-alt", pine: "prop-pine", apple: "prop-apple", rock: "prop-rock", sign: "prop-sign", fence: "prop-fence", hedge: "prop-hedge",
  well: "prop-well", bench: "prop-bench", mailbox: "prop-mailbox", lamp: "prop-lamp", itemBall: "prop-item",
  grassFront: "prop-grass-front", shadow: "prop-shadow", leaf: "fx-leaf", bubble: "fx-bubble", blades: "prop-blades", crystal: "prop-moon-crystal", firefly: "prop-firefly",
  crate: "prop-crate", barrel: "prop-barrel", hay: "prop-hay", planter: "prop-planter", lantern: "prop-lantern",
} as const;

function paintPineTree(ctx: Ctx, ox: number, oy: number) {
  ctx.fillStyle = "rgba(20,50,25,0.28)";
  ctx.beginPath(); ctx.ellipse(16, 59, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
  const bands = [
    { top: 1, height: 10, spread: 3, green: "#67b85b", shade: "#347d46" },
    { top: 8, height: 11, spread: 5, green: "#4ca653", shade: "#286b3d" },
    { top: 16, height: 11, spread: 7, green: "#348b4a", shade: "#205b39" },
  ];
  for (const band of bands) for (let row = 0; row < band.height; row++) {
    const half = Math.max(1, Math.floor((row + 1) / band.height * band.spread));
    const left = 8 - half, right = 8 + half;
    px(ctx, ox, oy, left - 1, band.top + row, "#183c28", half * 2 + 3, 1);
    px(ctx, ox, oy, left, band.top + row, band.green, half * 2 + 1, 1);
    px(ctx, ox, oy, left, band.top + row, "#a4e07c", Math.max(1, Math.floor(half * 0.55)), 1);
    if (row > band.height * 0.55) px(ctx, ox, oy, right - 1, band.top + row, band.shade, 2, 1);
  }
  px(ctx, ox, oy, 7, 24, "#5c3a1c", 3, 8);
  px(ctx, ox, oy, 7, 25, "#8a5a30", 1, 6);
  px(ctx, ox, oy, 6, 31, "#3c281c", 5, 1);
}
const ALT_TREE_PALETTE: Palette = { ...PAL.tree, d: "#286348", m: "#3d9256", l: "#78c86b", h: "#c0eb91" };

export function ensurePropTextures(scene: Phaser.Scene) {
  validatePatterns();
  canvasTexture(scene, PROP.tree, T, T * 2, (ctx) => paintPattern(ctx, pat("tree"), PAL.tree, 0, 0));
  canvasTexture(scene, PROP.treeAlt, T, T * 2, (ctx) => paintPattern(ctx, pat("tree"), ALT_TREE_PALETTE, 0, 0));
  canvasTexture(scene, PROP.pine, T, T * 2, (ctx) => paintPineTree(ctx, 0, 0));
  canvasTexture(scene, PROP.apple, T, T * 2, (ctx) => { paintPattern(ctx, pat("tree"), PAL.tree, 0, 0); paintPattern(ctx, pat("fruit"), PAL.fruit, 0, 0); });
  canvasTexture(scene, PROP.rock, T, T, (ctx) => paintPattern(ctx, pat("rock"), PAL.rock, 0, 0));
  canvasTexture(scene, PROP.hedge, T, T, (ctx) => paintPattern(ctx, pat("hedge"), PAL.hedge, 0, 0));
  canvasTexture(scene, PROP.well, T, T, (ctx) => paintPattern(ctx, pat("well"), PAL.well, 0, 0));
  canvasTexture(scene, PROP.bench, T, T, (ctx) => paintPattern(ctx, pat("bench"), PAL.bench, 0, 0));
  canvasTexture(scene, PROP.mailbox, T, T, (ctx) => paintPattern(ctx, pat("mailbox"), PAL.mailbox, 0, 0));
  canvasTexture(scene, PROP.lamp, T, T, (ctx) => paintPattern(ctx, pat("lamp"), PAL.lamp, 0, 0));
  canvasTexture(scene, PROP.itemBall, T, T, (ctx) => {
    ctx.fillStyle = "rgba(20,50,25,0.3)"; ctx.beginPath(); ctx.ellipse(16, 26, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Glowing bond crystal pickup (pixel facets: light left face, dark right face).
    ctx.fillStyle = "rgba(140,220,255,0.35)"; ctx.beginPath(); ctx.arc(16, 15, 11, 0, Math.PI * 2); ctx.fill();
    const facet = (color: string, pts: number[]) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); };
    facet("#183048", [16, 3, 25, 14, 16, 27, 7, 14]);
    facet("#5ab8f0", [16, 5, 23, 14, 16, 25]);
    facet("#c8f0ff", [16, 5, 9, 14, 16, 25]);
    facet("#ffffff", [16, 5, 12, 12, 16, 14]);
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
  canvasTexture(scene, PROP.crate, T, T, (ctx) => {
    ctx.fillStyle = "rgba(24,36,24,.28)"; ctx.fillRect(4, 26, 25, 4);
    ctx.fillStyle = "#4a2c1b"; ctx.fillRect(3, 8, 26, 19);
    ctx.fillStyle = "#b9783c"; ctx.fillRect(5, 9, 22, 16);
    ctx.fillStyle = "#d99b55"; ctx.fillRect(6, 10, 20, 2);
    ctx.fillStyle = "#754525"; ctx.fillRect(6, 15, 20, 2); ctx.fillRect(6, 22, 20, 2);
    ctx.fillStyle = "#e5b56d"; ctx.fillRect(5, 10, 2, 15); ctx.fillRect(25, 10, 2, 15);
    ctx.fillStyle = "#59351f"; ctx.fillRect(14, 10, 3, 15);
    ctx.fillStyle = "#f1c77e"; ctx.fillRect(7, 11, 1, 3); ctx.fillRect(24, 11, 1, 3);
  });
  canvasTexture(scene, PROP.barrel, T, T, (ctx) => {
    ctx.fillStyle = "rgba(24,36,24,.3)"; ctx.beginPath(); ctx.ellipse(16, 27, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#422b20"; ctx.fillRect(6, 7, 20, 19);
    ctx.fillStyle = "#9b6439"; ctx.fillRect(8, 8, 16, 17);
    ctx.fillStyle = "#bd8651"; ctx.fillRect(9, 9, 4, 14);
    ctx.fillStyle = "#613e2a"; ctx.fillRect(6, 8, 20, 3); ctx.fillRect(6, 22, 20, 3);
    ctx.fillStyle = "#d0ad76"; ctx.fillRect(7, 8, 18, 1); ctx.fillRect(7, 23, 18, 1);
    ctx.fillStyle = "#503322"; ctx.fillRect(15, 11, 2, 11);
  });
  canvasTexture(scene, PROP.hay, T, T, (ctx) => {
    ctx.fillStyle = "rgba(24,36,24,.28)"; ctx.beginPath(); ctx.ellipse(16, 27, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#79502b"; ctx.fillRect(4, 10, 24, 16);
    ctx.fillStyle = "#e2b84e"; ctx.fillRect(5, 8, 22, 16);
    ctx.fillStyle = "#f4d879"; ctx.fillRect(7, 9, 18, 3);
    ctx.fillStyle = "#b98537"; ctx.fillRect(5, 21, 22, 3);
    ctx.fillStyle = "#ffe89a"; ctx.fillRect(8, 12, 2, 8); ctx.fillRect(14, 12, 2, 8); ctx.fillRect(20, 12, 2, 8);
    ctx.fillStyle = "#9d6b30"; ctx.fillRect(4, 17, 1, 5); ctx.fillRect(27, 16, 1, 6);
  });
  canvasTexture(scene, PROP.planter, T, T, (ctx) => {
    ctx.fillStyle = "rgba(24,36,24,.26)"; ctx.beginPath(); ctx.ellipse(16, 28, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#653c31"; ctx.fillRect(7, 18, 18, 9);
    ctx.fillStyle = "#c46e4e"; ctx.fillRect(8, 18, 16, 8);
    ctx.fillStyle = "#e69a68"; ctx.fillRect(7, 17, 18, 3); ctx.fillRect(9, 21, 2, 4);
    ctx.fillStyle = "#543d26"; ctx.fillRect(9, 15, 14, 3);
    ctx.fillStyle = "#39834b"; ctx.fillRect(10, 10, 3, 7); ctx.fillRect(15, 6, 3, 11); ctx.fillRect(19, 10, 3, 7);
    ctx.fillStyle = "#a9e47a"; ctx.fillRect(10, 10, 2, 2); ctx.fillRect(16, 6, 2, 3); ctx.fillRect(20, 10, 2, 2);
    ctx.fillStyle = "#f6d37a"; ctx.fillRect(13, 9, 2, 2); ctx.fillStyle = "#f5a6c5"; ctx.fillRect(18, 8, 2, 2);
  });
  canvasTexture(scene, PROP.lantern, T, T, (ctx) => {
    ctx.fillStyle = "rgba(255,202,96,.14)"; ctx.beginPath(); ctx.arc(16, 14, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3c3028"; ctx.fillRect(10, 4, 12, 19); ctx.fillRect(13, 1, 6, 3);
    ctx.fillStyle = "#b47a3e"; ctx.fillRect(11, 6, 10, 14);
    ctx.fillStyle = "#ffcf70"; ctx.fillRect(13, 8, 6, 10);
    ctx.fillStyle = "#fff2b8"; ctx.fillRect(14, 9, 3, 7);
    ctx.fillStyle = "#6b462b"; ctx.fillRect(8, 20, 16, 3); ctx.fillRect(14, 23, 4, 7);
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

function fillPoly(ctx: Ctx, pts: [number, number][], fill: string, stroke = "#302a2d", width = 2) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

/** Tall red timber barn with a raised ridge, two roof planes and sliding doors. */
function ensureBarnTexture(scene: Phaser.Scene, b: BuildingDef) {
  const key = `bld-${b.id}`, W = b.w * T, base = BUILDING_OVERHANG + b.h * T;
  const H = b.h * T + BUILDING_OVERHANG + BUILDING_SHADOW, mid = W / 2;
  return canvasTexture(scene, key, W, H, (ctx) => {
    ctx.fillStyle = "rgba(15,28,20,.34)"; ctx.beginPath(); ctx.ellipse(mid, base + 5, W * .47, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Barn wall: deep timber edge, warm boards, side shadow and stone foundation.
    ctx.fillStyle = "#382b2d"; ctx.fillRect(5, 62, W - 10, base - 62);
    const wall = ctx.createLinearGradient(0, 65, 0, base);
    wall.addColorStop(0, "#d98b56"); wall.addColorStop(.65, "#b96542"); wall.addColorStop(1, "#834333");
    ctx.fillStyle = wall; ctx.fillRect(8, 64, W - 16, base - 68);
    for (let x = 12; x < W - 10; x += 12) {
      ctx.fillStyle = x % 24 ? "rgba(89,45,34,.28)" : "rgba(255,208,142,.2)";
      ctx.fillRect(x, 70, 2, base - 82);
    }
    ctx.fillStyle = "#50343a"; ctx.fillRect(8, base - 8, W - 16, 6);
    ctx.fillStyle = "#cf9868"; ctx.fillRect(10, base - 8, W - 20, 2);
    // Gable and cross-braced beams.
    fillPoly(ctx, [[mid, 43], [W - 12, 70], [12, 70]], "#e3a06b", "#53353a", 3);
    ctx.strokeStyle = "#754342"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(mid, 48); ctx.lineTo(mid, 70); ctx.moveTo(mid - 32, 53); ctx.lineTo(mid + 32, 68); ctx.moveTo(mid + 32, 53); ctx.lineTo(mid - 32, 68); ctx.stroke();
    // Two roof planes with darker right side and staggered shingle seams.
    fillPoly(ctx, [[mid, 2], [W - 3, 35], [W - 3, 67], [mid, 48]], shade(b.roof, -22), "#392b37", 3);
    fillPoly(ctx, [[mid, 2], [3, 35], [3, 67], [mid, 48]], css(b.roof), "#392b37", 3);
    for (let row = 0; row < 6; row++) {
      const y = 12 + row * 8;
      ctx.strokeStyle = row % 2 ? "rgba(255,190,150,.38)" : "rgba(75,35,42,.36)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mid - row * 5, y); ctx.lineTo(7, 34 + row * 5);
      ctx.moveTo(mid + row * 5, y); ctx.lineTo(W - 7, 34 + row * 5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#f3b17b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mid, 4); ctx.lineTo(mid, 47); ctx.stroke();
    ctx.strokeStyle = "#452d36"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(4, 67); ctx.lineTo(W - 4, 67); ctx.stroke();
    // Small loft vent with a warm light behind it.
    ctx.fillStyle = "#4d3338"; ctx.fillRect(mid - 11, 54, 22, 13);
    ctx.fillStyle = "#ffd38a"; ctx.fillRect(mid - 7, 57, 14, 7);
    ctx.fillStyle = "#75423a"; ctx.fillRect(mid - 1, 57, 2, 7); ctx.fillRect(mid - 7, 60, 14, 2);
    // Sliding double barn door, iron strap hinges and diagonal timber braces.
    const doorY = base - 49, doorW = 68, doorX = mid - doorW / 2;
    ctx.fillStyle = "#352a31"; ctx.fillRect(doorX - 4, doorY - 4, doorW + 8, 51);
    ctx.fillStyle = "#743d36"; ctx.fillRect(doorX, doorY, doorW, 44);
    ctx.fillStyle = "#b56845"; ctx.fillRect(doorX + 3, doorY + 3, doorW - 6, 38);
    ctx.fillStyle = "#693b36";
    for (let x = doorX + 8; x < doorX + doorW; x += 11) ctx.fillRect(x, doorY + 4, 2, 36);
    ctx.strokeStyle = "#e7ae74"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(doorX + 5, doorY + 6); ctx.lineTo(mid - 3, doorY + 37); ctx.moveTo(mid + 3, doorY + 37); ctx.lineTo(doorX + doorW - 5, doorY + 6); ctx.stroke();
    ctx.fillStyle = "#44313a"; ctx.fillRect(mid - 2, doorY + 3, 4, 37);
    ctx.fillStyle = "#f1d38c"; ctx.fillRect(mid - 5, doorY + 22, 3, 4); ctx.fillRect(mid + 2, doorY + 22, 3, 4);
    // Wall lanterns, a hanging wooden plaque and stone doorstep.
    for (const x of [18, W - 18]) {
      ctx.fillStyle = "#4b3433"; ctx.fillRect(x - 5, 78, 10, 17);
      ctx.fillStyle = "#ffcf79"; ctx.fillRect(x - 3, 81, 6, 10);
      ctx.fillStyle = "rgba(255,195,100,.28)"; ctx.fillRect(x - 8, 76, 16, 22);
    }
    ctx.fillStyle = "#493037"; ctx.fillRect(mid - 32, 73, 64, 12);
    ctx.fillStyle = "#f0d3a0"; ctx.fillRect(mid - 29, 75, 58, 8);
    if (b.plaque) drawPixelText(ctx, b.plaque, mid - pixelTextWidth(b.plaque, 1) / 2, 76, "#70432f", 1);
    ctx.fillStyle = "#4a3a37"; ctx.fillRect(mid - 42, base - 3, 84, 5);
    ctx.fillStyle = "#d1b58d"; ctx.fillRect(mid - 38, base - 3, 76, 2);
  });
}

/** Glass-and-timber greenhouse with layered roof panes, vents and flower beds. */
function ensureGreenhouseTexture(scene: Phaser.Scene, b: BuildingDef) {
  const key = `bld-${b.id}`, W = b.w * T, base = BUILDING_OVERHANG + b.h * T;
  const H = b.h * T + BUILDING_OVERHANG + BUILDING_SHADOW, mid = W / 2;
  return canvasTexture(scene, key, W, H, (ctx) => {
    ctx.fillStyle = "rgba(15,28,20,.30)"; ctx.beginPath(); ctx.ellipse(mid, base + 5, W * .46, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#493d3a"; ctx.fillRect(5, 35, W - 10, base - 35);
    ctx.fillStyle = "#b8dfc4"; ctx.fillRect(8, 38, W - 16, base - 46);
    fillPoly(ctx, [[mid, 0], [W - 6, 35], [6, 35]], "#344b48", "#31413c", 3);
    fillPoly(ctx, [[mid, 4], [W - 12, 32], [12, 32]], "#84c5b3", "#eff5d1", 2);
    // Glass roof catches light in diagonal panes.
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * Math.max(18, (W - 28) / 6);
      ctx.strokeStyle = i % 2 ? "rgba(237,255,235,.8)" : "rgba(44,104,96,.7)";
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mid, 5); ctx.lineTo(x, 32); ctx.stroke();
    }
    for (let x = 14; x < W - 12; x += 22) {
      ctx.strokeStyle = "#517b69"; ctx.lineWidth = 3; ctx.strokeRect(x, 42, 16, base - 54);
      ctx.fillStyle = x % 2 ? "rgba(225,255,239,.54)" : "rgba(104,184,169,.38)";
      ctx.fillRect(x + 2, 44, 12, base - 58);
      ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(x + 3, 46, 2, 17);
    }
    ctx.fillStyle = "#41644f"; ctx.fillRect(7, 38, W - 14, 5);
    ctx.fillStyle = "#f5df9c"; ctx.fillRect(mid - 18, base - 41, 36, 37);
    ctx.fillStyle = "#55775f"; ctx.fillRect(mid - 15, base - 38, 30, 34);
    ctx.fillStyle = "#a8d8c4"; ctx.fillRect(mid - 12, base - 35, 24, 29);
    ctx.fillStyle = "#e4f6db"; ctx.fillRect(mid - 2, base - 35, 3, 29); ctx.fillRect(mid - 12, base - 21, 24, 2);
    ctx.fillStyle = "#3d5a4c"; ctx.fillRect(9, base - 7, W - 18, 4);
    ctx.fillStyle = "#d9e6b5"; ctx.fillRect(12, base - 6, W - 24, 2);
    if (b.plaque) {
      ctx.fillStyle = "#4c5c48"; ctx.fillRect(mid - 34, 34, 68, 12);
      ctx.fillStyle = "#f4ebc6"; ctx.fillRect(mid - 31, 36, 62, 8);
      drawPixelText(ctx, b.plaque, mid - pixelTextWidth(b.plaque, 1) / 2, 37, "#426a51", 1);
    }
  });
}

/** Market workshop with timber framing, a striped canvas awning and display windows. */
function ensureShopTexture(scene: Phaser.Scene, b: BuildingDef) {
  const key = `bld-${b.id}`, W = b.w * T, base = BUILDING_OVERHANG + b.h * T;
  const H = b.h * T + BUILDING_OVERHANG + BUILDING_SHADOW;
  return canvasTexture(scene, key, W, H, (ctx) => {
    ctx.fillStyle = "rgba(15,28,20,.3)"; ctx.fillRect(8, base - 1, W - 12, 8);
    ctx.fillStyle = "#4c3334"; ctx.fillRect(4, 30, W - 8, base - 30);
    ctx.fillStyle = css(b.wall); ctx.fillRect(8, 34, W - 16, base - 42);
    ctx.fillStyle = "#4b3038"; ctx.fillRect(0, 3, W, 32);
    ctx.fillStyle = css(b.roof); ctx.fillRect(3, 6, W - 6, 25);
    for (let y = 12; y < 30; y += 8) { ctx.fillStyle = shade(b.roof, -20); ctx.fillRect(3, y, W - 6, 2); }
    // Alternating awning panels with a scalloped cloth edge.
    const awnY = 55, panel = Math.max(12, Math.floor((W - 24) / 8));
    for (let i = 0; i < 8; i++) {
      const x = 12 + i * panel;
      ctx.fillStyle = i % 2 ? "#f3e5c2" : "#c75e4c";
      ctx.fillRect(x, awnY, panel, 16);
      ctx.fillRect(x, awnY + 14, panel - 2, 4);
    }
    ctx.fillStyle = "#553d3a"; ctx.fillRect(10, awnY - 3, W - 20, 4);
    const windowY = awnY + 25;
    for (const x of [18, W - 58]) {
      ctx.fillStyle = "#4b3539"; ctx.fillRect(x - 3, windowY - 3, 42, 31);
      ctx.fillStyle = "#82c4d0"; ctx.fillRect(x, windowY, 36, 25);
      ctx.fillStyle = "#e5f7df"; ctx.fillRect(x + 2, windowY + 2, 14, 10);
      ctx.fillStyle = "#4d6c72"; ctx.fillRect(x + 17, windowY, 3, 25);
      ctx.fillRect(x, windowY + 12, 36, 2);
    }
    ctx.fillStyle = "#52383b"; ctx.fillRect(W / 2 - 15, windowY + 1, 30, base - windowY - 9);
    ctx.fillStyle = "#936040"; ctx.fillRect(W / 2 - 12, windowY + 4, 24, base - windowY - 16);
    ctx.fillStyle = "#e9c27d"; ctx.fillRect(W / 2 + 7, base - 26, 2, 3);
    ctx.fillStyle = "#4d3738"; ctx.fillRect(8, base - 6, W - 16, 4);
    if (b.plaque) {
      ctx.fillStyle = "#4c3034"; ctx.fillRect(W / 2 - 38, 34, 76, 16);
      ctx.fillStyle = "#f7e9c5"; ctx.fillRect(W / 2 - 35, 36, 70, 12);
      drawPixelText(ctx, b.plaque, W / 2 - pixelTextWidth(b.plaque, 1) / 2, 39, "#754c39", 1);
    }
  });
}

/** FireRed-style house: shingled roof with ridge and eaves, plank walls, framed windows, door, optional plaque/chimney. */
export function ensureBuildingTexture(scene: Phaser.Scene, b: BuildingDef) {
  if (b.style === "windmill") return ensureWindmillTexture(scene, b);
  if (b.style === "barn") return ensureBarnTexture(scene, b);
  if (b.style === "greenhouse") return ensureGreenhouseTexture(scene, b);
  if (b.style === "shop") return ensureShopTexture(scene, b);
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
export const CHAR_FRAME = { down: 0, up: 3, left: 6, right: 9 } as const;

/** Character sheet: 12 frames (4 directions × stand/walkA/walkB), each 32×32. */
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
