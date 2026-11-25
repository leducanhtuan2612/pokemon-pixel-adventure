import Phaser from "phaser";
import { ensurePlaceholders, preloadPokemonSprites } from "../battle/sprites";

/** Loads Pokémon sprites (whatever exists in src/assets) and fills gaps with placeholders. */
export class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }

  preload() {
    const bar = this.add.rectangle(170, 200, 0, 10, 0xd6e9a4).setOrigin(0, 0.5);
    this.add.text(320, 175, "Đang tải…", { fontFamily: "monospace", fontSize: "14px", color: "#d6e9a4" }).setOrigin(0.5);
    this.load.on("progress", (v: number) => (bar.width = 300 * v));
    this.load.on("loaderror", () => { /* missing art falls back to placeholders */ });
    preloadPokemonSprites(this);
  }

  create() {
    ensurePlaceholders(this);
    // Pixel font must be ready before any Phaser text is rasterised.
    const go = () => this.scene.start("OverworldScene");
    if (document.fonts?.load) Promise.race([document.fonts.load('26px "VT323"'), new Promise((r) => setTimeout(r, 1500))]).then(go, go);
    else go();
  }
}
