import Phaser from "phaser";
import { SPECIES_LIST, getSpecies } from "../data/species";
import { createPetSpriteCanvas, petSpriteDataUrl } from "./petArt";

export const spriteKey = (speciesId: string, view: "front" | "back") => `pet-${view}-${speciesId}`;
export const hasBack = (scene: Phaser.Scene, speciesId: string) => scene.textures.exists(spriteKey(speciesId, "back"));

/** Character art is generated in-game; no third-party monster sprites are loaded. */
export function preloadPokemonSprites(scene: Phaser.Scene) {
  // Kept under the legacy name because BootScene already calls this hook.
  // Textures are tiny canvas sprites and are created synchronously in ensurePlaceholders.
  void scene;
}

/** Creates original elemental companion sprites for the full creature roster. */
export function ensurePlaceholders(scene: Phaser.Scene) {
  for (const sp of SPECIES_LIST) {
    for (const view of ["front", "back"] as const) {
      const key = spriteKey(sp.id, view);
      if (scene.textures.exists(key)) continue;
      const art = createPetSpriteCanvas(sp.id, view);
      const texture = scene.textures.addCanvas(key, art);
      texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}

/** Shiny variant: hue-rotated copy of the original pet sprite, generated once. */
export function shinyKey(scene: Phaser.Scene, speciesId: string, view: "front" | "back") {
  const base = spriteKey(speciesId, view), key = `${base}-shiny`;
  if (scene.textures.exists(key) || !scene.textures.exists(base)) return scene.textures.exists(key) ? key : base;
  const src = scene.textures.get(base).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max - min < 0.08) continue;
    const s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    let h = max === r ? (g - b) / (max - min) + (g < b ? 6 : 0) : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    h = ((h / 6 + 0.42) % 1 + 1) % 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t: number) => {
      t = (t + 1) % 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    d[i] = f(h + 1 / 3) * 255; d[i + 1] = f(h) * 255; d[i + 2] = f(h - 1 / 3) * 255;
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** Data URL used by the React collection, party and gacha panels. */
export const spriteUrl = (speciesId: string) => {
  try { return petSpriteDataUrl(getSpecies(speciesId).id); }
  catch { return null; }
};
