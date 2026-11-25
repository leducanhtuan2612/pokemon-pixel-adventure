import Phaser from "phaser";
import { ensurePlaceholders, preloadPokemonSprites } from "../battle/sprites";
import { createPokemon } from "../core/pokemon";

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
    const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get("fxdemo") : null;
    const go = demo ? () => this.startDemo(demo) : () => this.scene.start("OverworldScene");
    if (document.fonts?.load) Promise.race([document.fonts.load('26px "VT323"'), new Promise((r) => setTimeout(r, 1500))]).then(go, go);
    else go();
  }

  /** Dev-only: jump straight into a battle that auto-plays one move (e.g. ?fxdemo=flamethrower or ?fxdemo=ult). */
  private startDemo(move: string) {
    const species = new URLSearchParams(location.search).get("mon") ?? "charmander";
    const bag = { count: () => 0, take: () => false };
    this.scene.start("BattleScene", {
      demo: move,
      setup: {
        kind: "wild", playerParty: [createPokemon(species, 40)], foeParty: [createPokemon("bulbasaur", 40)], bag,
        onCaught: () => "party", onSeen: () => {}, hasCaught: () => false,
      },
      onEnd: () => {},
    });
  }
}
