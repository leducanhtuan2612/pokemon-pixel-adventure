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
export const CHARACTER_FRAMES: { dir: "down" | "up" | "left" | "right"; pose: Pose; pattern: Pattern }[] = [];
for (const dir of ["down", "up", "left"] as const) {
  for (const pose of POSES) {
    const head = dir === "down" ? HEAD_DOWN : dir === "up" ? HEAD_UP : HEAD_LEFT;
    const body = dir === "down" ? BODY_DOWN : dir === "up" ? BODY_UP : BODY_LEFT;
    const feet = dir === "left" ? FEET_SIDE[pose] : FEET_FRONT[pose];
    // Each direction has a consistent idle + two-step cycle.
    const pattern = pose === "stand"
      ? [...head, ...body, ...feet]
      : ["................", ...head, ...body.slice(0, 4), ...feet];
    CHARACTER_FRAMES.push({ dir, pose, pattern });
  }
}
// A true right-facing sheet avoids the old mirrored-left pose at runtime.
// Mirror every pixel row once during texture generation; no flip state leaks
// into the shadow, UI portrait, or the next animation frame.
for (const frame of CHARACTER_FRAMES.filter((f) => f.dir === "left")) {
  CHARACTER_FRAMES.push({
    dir: "right", pose: frame.pose,
    pattern: frame.pattern.map((row) => row.split("").reverse().join("")),
  });
}

const base = { k: "#202030", w: "#f8f8f8", s: "#f8d0a0" };
export const CHARACTER_PALETTES: Record<CharacterLook, Palette> = {
  player: { ...base, r: "#e04848", R: "#a83040", h: "#3a2a2a", j: "#3a7bd5", g: "#f0c040", p: "#34344a" },
  nurse: { ...base, r: "#f8f8f8", R: "#f4a0c0", w: "#e04870", h: "#e07098", j: "#f8c8d8", g: "#f8f8f8", p: "#f090b0" },
  ranger: { ...base, r: "#4a8a4a", R: "#2e5e34", h: "#6a4a30", j: "#6a9a5a", g: "#c8a060", p: "#5a4a3a" },
  bugCatcher: { ...base, r: "#f0d050", R: "#c0a030", h: "#4a3020", j: "#80c060", g: "#e0e0e0", p: "#4060a0" },
  lass: { ...base, r: "#e06080", R: "#b04060", h: "#c07040", j: "#f088a8", g: "#ffffff", p: "#6040a0" },
  hiker: { ...base, r: "#a06030", R: "#704020", h: "#302020", j: "#c08040", g: "#708050", p: "#506040" },
  mom: { ...base, r: "#e87890", R: "#c05870", h: "#6a3a2a", j: "#f0a0b0", g: "#f8f8f8", p: "#8060a0" },
  professor: { ...base, r: "#7a5030", R: "#5a3820", h: "#7a5030", j: "#f0f0f0", g: "#58a0d8", p: "#40506a" },
  farmer: { ...base, r: "#e8c868", R: "#b89840", h: "#4a3020", j: "#5878b8", g: "#d84848", p: "#3a4a78" },
  kid: { ...base, r: "#58b8f0", R: "#3888c0", h: "#3a2a20", j: "#f8d048", g: "#f87848", p: "#58a058" },
  oldman: { ...base, r: "#a8a8a8", R: "#888888", h: "#e0e0e0", j: "#8a6a50", g: "#c8a878", p: "#5a4a3a" },
  girl: { ...base, r: "#f8a8c8", R: "#d080a0", h: "#e0a050", j: "#a8d878", g: "#ffffff", p: "#f07890" },
  youngster: { ...base, r: "#f8f8f8", R: "#c8c8c8", h: "#4a3020", j: "#f8a838", g: "#4878d8", p: "#4060a0" },
  vendor: { ...base, r: "#58a058", R: "#3a7a3a", h: "#7a4a2a", j: "#f8e8c8", g: "#e86048", p: "#6a5040" },
  clerk: { ...base, r: "#3a78c8", R: "#285898", h: "#5a3a2a", j: "#5aa0e0", g: "#f8f8f8", p: "#3a4a6a" },
  guardian: { ...base, r: "#6a3a9a", R: "#4a2a70", w: "#f0d060", h: "#e0e0f0", j: "#8a5ab8", g: "#d0b040", p: "#3a2a5a" },
};

/** Throws early in dev if any character frame is not 16×16 — keeps art honest. */
export function validatePatterns() {
  CHARACTER_FRAMES.forEach((f, i) => {
    if (f.pattern.length !== 16 || f.pattern.some((r) => r.length !== 16)) throw new Error(`Character frame ${i} must be 16×16`);
  });
}
