import Phaser from "phaser";
import { SPECIES_LIST, getSpecies } from "../data/species";
import { TYPE_COLORS } from "../data/types";

/**
 * Pokémon sprites are discovered at build time: drop PNGs into
 * src/assets/sprites/pokemon/front/ named by National Dex number (001.png, 25.png)
 * or species id (pikachu.png). Optional back sprites go in .../back/.
 * Anything missing gets a generated placeholder so the game never breaks.
 */
const files = import.meta.glob("../../assets/sprites/pokemon/*/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

function findUrl(view: "front" | "back", speciesId: string): string | undefined {
  const sp = getSpecies(speciesId);
  const names = [String(sp.dex).padStart(3, "0"), String(sp.dex), sp.id];
  for (const n of names) {
    const hit = Object.entries(files).find(([path]) => path.endsWith(`/${view}/${n}.png`));
    if (hit) return hit[1];
  }
  return undefined;
}

export const spriteKey = (speciesId: string, view: "front" | "back") => `pkmn-${view}-${speciesId}`;
/** Back sprites fall back to the flipped front sprite. */
export const hasBack = (scene: Phaser.Scene, speciesId: string) => scene.textures.exists(spriteKey(speciesId, "back"));

export function preloadPokemonSprites(scene: Phaser.Scene) {
  for (const sp of SPECIES_LIST) {
    for (const view of ["front", "back"] as const) {
      const url = findUrl(view, sp.id);
      if (url) scene.load.image(spriteKey(sp.id, view), url);
    }
  }
}

/** Creates placeholders for species without art (call after loading). */
export function ensurePlaceholders(scene: Phaser.Scene) {
  for (const sp of SPECIES_LIST) {
    const key = spriteKey(sp.id, "front");
    if (scene.textures.exists(key)) { scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST); continue; }
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d")!;
    const main = TYPE_COLORS[sp.types[0]], accent = TYPE_COLORS[sp.types[1] ?? sp.types[0]];
    // Generic egg silhouette with a "?" — clearly a stand-in, not a character.
    const egg = ["....kkkk....", "...kmmmmk...", "..kmmaammk..", ".kmmmmmmmmk.", ".kmmakkammk.", "kmmmmmkammmk", "kmmmmkammmmk", "kmammmmmmamk", "kmmmmkmmmmmk", ".kmmmmmmmmk.", "..kkmmmmkk..", "....kkkk...."];
    egg.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = ch === "k" ? "#202030" : ch === "a" ? accent : main;
      ctx.fillRect(x + 2, y + 3, 1, 1);
    }));
    scene.textures.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  for (const sp of SPECIES_LIST) {
    const key = spriteKey(sp.id, "back");
    if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

/** Public URL for React panels (null when only a placeholder exists). */
export const spriteUrl = (speciesId: string) => findUrl("front", speciesId) ?? null;
