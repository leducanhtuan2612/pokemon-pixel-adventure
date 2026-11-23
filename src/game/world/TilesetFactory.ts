import Phaser from "phaser";
import {
  ART_SCALE, CHARACTER_FRAMES, CHARACTER_PALETTES, ROCK, ROCK_PALETTE, SIGN, SIGN_PALETTE,
  TALL_GRASS, TALL_GRASS_PALETTE, TREE, TREE_PALETTE, paintPattern, validatePatterns,
} from "./pixelArt";
import type { CharacterLook } from "./types";

export const TILE_SIZE = 32;
export const TILESET_KEY = "tileset-overworld";
const COLS = 16;

/** Indices into the generated tileset. Path/water use base + 4-bit neighbour mask (N=1,E=2,S=4,W=8). */
export const TILE_INDEX = {
  ground: [0, 1, 2, 3],
  flowers: [4, 5],
  tallGrass: 6,
  tree: 7,
  rock: 8,
  sign: 9,
  cliff: 10,
  fence: 11,
  sand: 12,
  pathBase: 16,
  waterBase: 32,
} as const;

const GROUND = { base: "#80c870", dark: "#62ae5c", light: "#a4dc8c" };

// Small deterministic hash so the art is identical every load.
const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

type Ctx = CanvasRenderingContext2D;
const px = (ctx: Ctx, ox: number, oy: number, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(ox + x * ART_SCALE, oy + y * ART_SCALE, w * ART_SCALE, h * ART_SCALE);
};

function paintGround(ctx: Ctx, ox: number, oy: number, variant: number) {
  ctx.fillStyle = GROUND.base;
  ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
  for (let i = 0; i < 6 + variant; i++) {
    const x = Math.floor(hash(variant, i, 1) * 15);
    const y = Math.floor(hash(variant, i, 2) * 15);
    // Tiny grass tufts: a "v" of two dark pixels with a light tip.
    px(ctx, ox, oy, x, y + 1, GROUND.dark);
    px(ctx, ox, oy, x + 1, y, i % 2 ? GROUND.light : GROUND.dark);
  }
}

function paintFlowers(ctx: Ctx, ox: number, oy: number, variant: number) {
  paintGround(ctx, ox, oy, 0);
  const petals = variant === 0 ? ["#f8f8f8", "#f8e060"] : ["#f88098", "#f8d0d8"];
  const spots = variant === 0 ? [[3, 3], [10, 9]] : [[9, 2], [3, 10]];
  for (const [x, y] of spots) {
    px(ctx, ox, oy, x, y - 1, petals[0]); px(ctx, ox, oy, x - 1, y, petals[0]);
    px(ctx, ox, oy, x + 1, y, petals[0]); px(ctx, ox, oy, x, y + 1, petals[0]);
    px(ctx, ox, oy, x, y, petals[1]);
    px(ctx, ox, oy, x, y + 2, "#3e8a40");
  }
}

function paintCliff(ctx: Ctx, ox: number, oy: number) {
  ctx.fillStyle = "#8a6a5a";
  ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
  for (let y = 0; y < 16; y += 4) {
    px(ctx, ox, oy, 0, y, "#5a4040", 16, 1);
    px(ctx, ox, oy, 0, y + 1, "#b08a70", 16, 1);
    const shift = (y / 4) % 2 ? 3 : 7;
    px(ctx, ox, oy, shift, y + 2, "#6e5048", 1, 2);
    px(ctx, ox, oy, shift + 8, y + 2, "#6e5048", 1, 2);
  }
  px(ctx, ox, oy, 2, 6, "#c8a088"); px(ctx, ox, oy, 11, 14, "#c8a088");
}

function paintFence(ctx: Ctx, ox: number, oy: number) {
  paintGround(ctx, ox, oy, 1);
  const k = "#4a2e1c", w = "#e8c890", d = "#a87848";
  for (const x of [1, 9]) {
    px(ctx, ox, oy, x, 3, k, 4, 11); px(ctx, ox, oy, x + 1, 4, w, 2, 9); px(ctx, ox, oy, x + 1, 12, d, 2, 1);
  }
  px(ctx, ox, oy, 0, 6, k, 16, 3); px(ctx, ox, oy, 0, 7, w, 16, 1);
  px(ctx, ox, oy, 0, 10, k, 16, 3); px(ctx, ox, oy, 0, 11, w, 16, 1);
  px(ctx, ox, oy, 0, 14, "#4f9a52", 16, 1);
}

function paintSand(ctx: Ctx, ox: number, oy: number) {
  ctx.fillStyle = "#e8d8a0";
  ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
  for (let i = 0; i < 7; i++) px(ctx, ox, oy, Math.floor(hash(9, i) * 16), Math.floor(hash(9, i, 3) * 16), i % 2 ? "#d0bc80" : "#f8ecc0");
}

function paintPath(ctx: Ctx, ox: number, oy: number, mask: number) {
  ctx.fillStyle = "#e0c890";
  ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
  for (let i = 0; i < 6; i++) px(ctx, ox, oy, 1 + Math.floor(hash(mask, i) * 14), 1 + Math.floor(hash(mask, i, 5) * 14), i % 2 ? "#c8ac70" : "#f0dcac");
  // Grass edges on every side that does not continue the path.
  const edge = "#b09060", grass = GROUND.base;
  const bump = (i: number) => (hash(mask, i, 7) > 0.5 ? 1 : 0);
  if (!(mask & 1)) for (let x = 0; x < 16; x++) { px(ctx, ox, oy, x, 0, grass, 1, 1 + bump(x)); px(ctx, ox, oy, x, 1 + bump(x), edge); }
  if (!(mask & 4)) for (let x = 0; x < 16; x++) { px(ctx, ox, oy, x, 15 - bump(x + 20), grass, 1, 1 + bump(x + 20)); px(ctx, ox, oy, x, 14 - bump(x + 20), edge); }
  if (!(mask & 8)) for (let y = 0; y < 16; y++) { px(ctx, ox, oy, 0, y, grass, 1 + bump(y + 40), 1); px(ctx, ox, oy, 1 + bump(y + 40), y, edge); }
  if (!(mask & 2)) for (let y = 0; y < 16; y++) { px(ctx, ox, oy, 15 - bump(y + 60), y, grass, 1 + bump(y + 60), 1); px(ctx, ox, oy, 14 - bump(y + 60), y, edge); }
}

function paintWater(ctx: Ctx, ox: number, oy: number, mask: number) {
  ctx.fillStyle = "#4890d8";
  ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
  // Ripples
  px(ctx, ox, oy, 3, 4, "#80c0f0", 4, 1); px(ctx, ox, oy, 4, 5, "#a8d8f8", 2, 1);
  px(ctx, ox, oy, 10, 10, "#80c0f0", 4, 1); px(ctx, ox, oy, 11, 11, "#a8d8f8", 2, 1);
  px(ctx, ox, oy, 8, 2, "#3878c0", 3, 1); px(ctx, ox, oy, 2, 13, "#3878c0", 3, 1);
  // Shoreline: foam + darker lip where water meets land.
  const foam = "#d8f0f8", lip = "#2c6aa8";
  if (!(mask & 1)) { px(ctx, ox, oy, 0, 0, foam, 16, 1); px(ctx, ox, oy, 0, 1, lip, 16, 1); }
  if (!(mask & 4)) { px(ctx, ox, oy, 0, 15, foam, 16, 1); px(ctx, ox, oy, 0, 14, "#70b0e8", 16, 1); }
  if (!(mask & 8)) { px(ctx, ox, oy, 0, 0, foam, 1, 16); px(ctx, ox, oy, 1, 0, lip, 1, 16); }
  if (!(mask & 2)) { px(ctx, ox, oy, 15, 0, foam, 1, 16); px(ctx, ox, oy, 14, 0, lip, 1, 16); }
}

/** Builds the overworld tileset once and registers it as a Phaser texture. */
export function ensureTileset(scene: Phaser.Scene) {
  if (scene.textures.exists(TILESET_KEY)) return;
  validatePatterns();
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE_SIZE;
  canvas.height = 3 * TILE_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const at = (i: number): [number, number] => [(i % COLS) * TILE_SIZE, Math.floor(i / COLS) * TILE_SIZE];

  TILE_INDEX.ground.forEach((idx, v) => paintGround(ctx, ...at(idx), v));
  TILE_INDEX.flowers.forEach((idx, v) => paintFlowers(ctx, ...at(idx), v));
  { const [x, y] = at(TILE_INDEX.tallGrass); paintGround(ctx, x, y, 0); paintPattern(ctx, TALL_GRASS, TALL_GRASS_PALETTE, x, y); }
  { const [x, y] = at(TILE_INDEX.tree); paintGround(ctx, x, y, 2); paintPattern(ctx, TREE, TREE_PALETTE, x, y); }
  { const [x, y] = at(TILE_INDEX.rock); paintGround(ctx, x, y, 1); paintPattern(ctx, ROCK, ROCK_PALETTE, x, y); }
  { const [x, y] = at(TILE_INDEX.sign); paintGround(ctx, x, y, 3); paintPattern(ctx, SIGN, SIGN_PALETTE, x, y); }
  paintCliff(ctx, ...at(TILE_INDEX.cliff));
  paintFence(ctx, ...at(TILE_INDEX.fence));
  paintSand(ctx, ...at(TILE_INDEX.sand));
  for (let m = 0; m < 16; m++) {
    paintPath(ctx, ...at(TILE_INDEX.pathBase + m), m);
    paintWater(ctx, ...at(TILE_INDEX.waterBase + m), m);
  }
  scene.textures.addCanvas(TILESET_KEY, canvas);
}

export const characterTextureKey = (look: CharacterLook) => `char-${look}`;
export const CHAR_FRAME = { down: 0, up: 3, left: 6 } as const;

/** Character sheet: 9 frames (down/up/left × stand/walkA/walkB), each 32×32. */
export function ensureCharacterTexture(scene: Phaser.Scene, look: CharacterLook) {
  const key = characterTextureKey(look);
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement("canvas");
  canvas.width = CHARACTER_FRAMES.length * TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d")!;
  CHARACTER_FRAMES.forEach((f, i) => {
    // Soft ground shadow under the feet.
    ctx.fillStyle = "rgba(20,40,20,0.28)";
    ctx.fillRect(i * TILE_SIZE + 8, 28, 16, 4);
    paintPattern(ctx, f.pattern, CHARACTER_PALETTES[look], i * TILE_SIZE, 0);
  });
  const tex = scene.textures.addCanvas(key, canvas)!;
  CHARACTER_FRAMES.forEach((_, i) => tex.add(i, 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE));
  return key;
}
