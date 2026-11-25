import type { CharacterLook } from "./types";

/**
 * Hand-authored 16×16 pixel patterns, painted at 2× so every art pixel is a
 * crisp 2×2 block on the 32px grid. '.' is transparent.
 */
export type Pattern = string[];
export type Palette = Record<string, string>;

export const ART_SCALE = 2;

export const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

export function paintPattern(ctx: CanvasRenderingContext2D, pattern: Pattern, palette: Palette, ox: number, oy: number, flipX = false) {
  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!palette[ch] || (ch === "." && !palette["."])) continue;
      const dx = flipX ? row.length - 1 - x : x;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(ox + dx * ART_SCALE, oy + y * ART_SCALE, ART_SCALE, ART_SCALE);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Characters: one template, swapped palettes per look.                */
/* k outline · r cap · R cap shade · w white · s skin · h hair         */
/* j jacket · g accent/backpack · p pants                              */
/* ------------------------------------------------------------------ */

const HEAD_DOWN = [
  ".....kkkkkk.....",
  "....krrrrrrk....",
  "...krrwwrrrrk...",
  "...kRRRRRRRRk...",
  "..kkkkkkkkkkkk..",
  "...khsssssshk...",
  "...kssksskssk...",
  "...kssssssssk...",
  "....kssssssk....",
];
const BODY_DOWN = [
  "...kjjjwwjjjk...",
  "..kjjjjwwjjjjk..",
  "..ksjjjwwjjjsk..",
  "...kjjjjjjjjk...",
  "...kppppppppk...",
];
const HEAD_UP = [
  ".....kkkkkk.....",
  "....krrrrrrk....",
  "...krrrrrrrrk...",
  "...kRRRRRRRRk...",
  "..kkkkkkkkkkkk..",
  "...khhhhhhhhk...",
  "...khhhhhhhhk...",
  "...khhhhhhhhk...",
  "....khhhhhhk....",
];
const BODY_UP = [
  "...kjggggggjk...",
  "..kjjggggggjjk..",
  "..ksjggggggjsk..",
  "...kjjjjjjjjk...",
  "...kppppppppk...",
];
const HEAD_LEFT = [
  ".....kkkkkk.....",
  "....krrrrrrk....",
  "...krrrrrrrrk...",
  "..kRRRRRRRRRk...",
  ".kkkkkkkkkkk....",
  "...kshhhhhhk....",
  "...ksksshhhk....",
  "..ksssssshhk....",
  "...kssssshk.....",
];
const BODY_LEFT = [
  "....kjjjjggk....",
  "....kjjjjggk....",
  "....ksjjjggk....",
  "....kjjjjjjk....",
  "....kppppppk....",
];

const FEET_FRONT = {
  stand: ["...kppk..kppk...", "...kkkk..kkkk..."],
  walkA: ["...kppk..kkkk...", "...kkkk........."],
  walkB: ["...kkkk..kppk...", ".........kkkk..."],
};
const FEET_SIDE = {
  stand: ["....kppkkppk....", "....kkkkkkkk...."],
  walkA: ["...kppk.kppk....", "...kkkk.kkkk...."],
  walkB: ["....kpppppk.....", ".....kkkkk......"],
};

type Pose = "stand" | "walkA" | "walkB";
const POSES: Pose[] = ["stand", "walkA", "walkB"];

/** Frame order in the character sheet: down×3, up×3, left×3 (right = flipped left). */
export const CHARACTER_FRAMES: { dir: "down" | "up" | "left"; pose: Pose; pattern: Pattern }[] = [];
for (const dir of ["down", "up", "left"] as const) {
  for (const pose of POSES) {
    const head = dir === "down" ? HEAD_DOWN : dir === "up" ? HEAD_UP : HEAD_LEFT;
    const body = dir === "down" ? BODY_DOWN : dir === "up" ? BODY_UP : BODY_LEFT;
    const feet = dir === "left" ? FEET_SIDE[pose] : FEET_FRONT[pose];
    // Walking frames bob the upper body down one art pixel (the pants row
    // is absorbed by the stride) so steps read clearly at small size.
    const pattern = pose === "stand"
      ? [...head, ...body, ...feet]
      : ["................", ...head, ...body.slice(0, 4), ...feet];
    CHARACTER_FRAMES.push({ dir, pose, pattern });
  }
}

const base = { k: "#202030", w: "#f8f8f8", s: "#f8d0a0" };
export const CHARACTER_PALETTES: Record<CharacterLook, Palette> = {
  player: { ...base, r: "#e04848", R: "#a83040", h: "#3a2a2a", j: "#3a7bd5", g: "#f0c040", p: "#34344a" },
  nurse: { ...base, r: "#f8f8f8", R: "#f4a0c0", w: "#e04870", h: "#e07098", j: "#f8c8d8", g: "#f8f8f8", p: "#f090b0" },
  ranger: { ...base, r: "#4a8a4a", R: "#2e5e34", h: "#6a4a30", j: "#6a9a5a", g: "#c8a060", p: "#5a4a3a" },
  bugCatcher: { ...base, r: "#f0d050", R: "#c0a030", h: "#4a3020", j: "#80c060", g: "#e0e0e0", p: "#4060a0" },
  lass: { ...base, r: "#e06080", R: "#b04060", h: "#c07040", j: "#f088a8", g: "#ffffff", p: "#6040a0" },
  hiker: { ...base, r: "#a06030", R: "#704020", h: "#302020", j: "#c08040", g: "#708050", p: "#506040" },
  clerk: { ...base, r: "#3a78c8", R: "#285898", h: "#5a3a2a", j: "#5aa0e0", g: "#f8f8f8", p: "#3a4a6a" },
  guardian: { ...base, r: "#6a3a9a", R: "#4a2a70", w: "#f0d060", h: "#e0e0f0", j: "#8a5ab8", g: "#d0b040", p: "#3a2a5a" },
};

/** Throws early in dev if any character frame is not 16×16 — keeps art honest. */
export function validatePatterns() {
  CHARACTER_FRAMES.forEach((f, i) => {
    if (f.pattern.length !== 16 || f.pattern.some((r) => r.length !== 16)) throw new Error(`Character frame ${i} must be 16×16`);
  });
}
