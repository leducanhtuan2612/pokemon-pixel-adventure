import Phaser from "phaser";
import { PATH_LIKE, WATER_LIKE, ruleFor } from "./tiles";
import {
  CHAR_FRAME, TILESET_KEY, TILE_INDEX, TILE_SIZE, ensureCharacterTexture, ensureTileset,
} from "./TilesetFactory";
import type { BuildingDef, Direction, ExitDef, MapDefinition, NpcDef, Point, SignDef } from "./types";

const key = (x: number, y: number) => `${x},${y}`;

export interface NpcRuntime { def: NpcDef; x: number; y: number; sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text }

/**
 * Runtime view of a MapDefinition: renders it with a Phaser Tilemap and
 * answers spatial questions (collision, encounters, what's at a tile).
 * Gameplay never reads the ASCII layout directly.
 */
export class WorldMap {
  readonly width: number;
  readonly height: number;
  readonly npcs: NpcRuntime[] = [];
  private tilemap?: Phaser.Tilemaps.Tilemap;

  constructor(private scene: Phaser.Scene, readonly def: MapDefinition) {
    this.height = def.layout.length;
    this.width = def.layout[0]?.length ?? 0;
    const bad = def.layout.findIndex((r) => r.length !== this.width);
    if (bad >= 0) throw new Error(`Map ${def.id}: row ${bad} has ${def.layout[bad].length} tiles, expected ${this.width}`);
  }

  get pixelWidth() { return this.width * TILE_SIZE; }
  get pixelHeight() { return this.height * TILE_SIZE; }

  charAt(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return "T";
    return this.def.layout[y][x];
  }

  npcAt(x: number, y: number) { return this.npcs.find((n) => n.x === x && n.y === y); }
  signAt(x: number, y: number): SignDef | undefined { return this.def.signs.find((s) => s.x === x && s.y === y); }
  doorAt(x: number, y: number): BuildingDef | undefined { return this.def.buildings.find((b) => b.door.x === x && b.door.y === y); }
  exitAt(x: number, y: number): ExitDef | undefined { return this.def.exits.find((e) => e.x === x && e.y === y); }

  isBlocked(x: number, y: number) { return ruleFor(this.charAt(x, y)).solid || !!this.npcAt(x, y); }
  isEncounterTile(x: number, y: number) { return !!ruleFor(this.charAt(x, y)).encounter; }

  /** Renders tile layer, buildings, NPCs and map labels. `defeated` places beaten NPCs where they belong. */
  build(defeated: readonly string[]) {
    ensureTileset(this.scene);
    const data = this.def.layout.map((row, y) => [...row].map((ch, x) => this.tileIndex(ch, x, y)));
    this.tilemap = this.scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = this.tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0)!;
    this.tilemap.createLayer(0, tileset, 0, 0)!.setDepth(0);

    for (const b of this.def.buildings) this.drawBuilding(b);
    for (const def of this.def.npcs) this.spawnNpc(def, defeated.includes(def.id));
    this.drawExitMarkers();
  }

  destroy() { this.tilemap?.destroy(); }

  moveNpc(n: NpcRuntime, to: Point) {
    n.x = to.x; n.y = to.y;
    this.scene.tweens.add({ targets: n.sprite, x: to.x * TILE_SIZE + 16, y: to.y * TILE_SIZE + 16, duration: 260 });
    this.scene.tweens.add({ targets: n.label, x: to.x * TILE_SIZE + 16, y: to.y * TILE_SIZE - 6, duration: 260 });
    n.sprite.setDepth(10 + to.y);
  }

  faceNpc(n: NpcRuntime, dir: Direction) { setCharacterFrame(n.sprite, dir, 0); }

  private tileIndex(ch: string, x: number, y: number): number {
    const h = (x * 73856093) ^ (y * 19349663);
    switch (ch) {
      case "*": return TILE_INDEX.flowers[Math.abs(h) % 2];
      case ":": return TILE_INDEX.tallGrass;
      case "T": return TILE_INDEX.tree;
      case "R": return TILE_INDEX.rock;
      case "S": return TILE_INDEX.sign;
      case "C": return TILE_INDEX.cliff;
      case "F": return TILE_INDEX.fence;
      case "s": return TILE_INDEX.sand;
      case "=": case "E": return TILE_INDEX.pathBase + this.mask(x, y, PATH_LIKE);
      case "~": return TILE_INDEX.waterBase + this.mask(x, y, WATER_LIKE);
      default: {
        // Mostly plain ground with occasional tufted variants.
        const r = Math.abs(h) % 10;
        return TILE_INDEX.ground[r < 6 ? 0 : r < 8 ? 1 : r < 9 ? 2 : 3];
      }
    }
  }

  private mask(x: number, y: number, set: Set<string>) {
    const same = (cx: number, cy: number) => (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) ? true : set.has(this.charAt(cx, cy));
    return (same(x, y - 1) ? 1 : 0) | (same(x + 1, y) ? 2 : 0) | (same(x, y + 1) ? 4 : 0) | (same(x - 1, y) ? 8 : 0);
  }

  private drawBuilding(b: BuildingDef) {
    const g = this.scene.add.graphics().setDepth(2);
    const T = TILE_SIZE, x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
    const roofH = Math.round(h * 0.55);
    const outline = 0x2a2030;
    const shade = Phaser.Display.Color.IntegerToColor(b.roof).darken(25).color;
    const light = Phaser.Display.Color.IntegerToColor(b.roof).lighten(18).color;

    // Ground shadow + walls
    g.fillStyle(0x1c3a20, 0.25).fillRect(x + 4, y + h - 2, w, 6);
    g.fillStyle(outline, 1).fillRect(x + 2, y + roofH - 4, w - 4, h - roofH + 4);
    g.fillStyle(b.wall, 1).fillRect(x + 4, y + roofH - 2, w - 8, h - roofH);
    g.fillStyle(0x000000, 0.12).fillRect(x + 4, y + h - 8, w - 8, 6);
    // Roof with shingle rows
    g.fillStyle(outline, 1).fillRect(x, y + 4, w, roofH);
    g.fillStyle(b.roof, 1).fillRect(x + 2, y + 6, w - 4, roofH - 6);
    for (let r = 0; r < Math.floor((roofH - 8) / 6); r++) {
      g.fillStyle(shade, 1).fillRect(x + 2, y + 10 + r * 6, w - 4, 2);
      for (let c = (r % 2) * 8; c < w - 4; c += 16) g.fillStyle(shade, 1).fillRect(x + 2 + c, y + 6 + r * 6, 2, 6);
    }
    g.fillStyle(light, 1).fillRect(x + 2, y + 6, w - 4, 2);
    g.fillStyle(shade, 1).fillRect(x + 2, y + roofH - 2, w - 4, 2);
    // Windows on the wall, skipping the door column.
    for (let tx = b.x; tx < b.x + b.w; tx++) {
      if (tx === b.door.x || tx === b.x || tx === b.x + b.w - 1) continue;
      if ((tx - b.x) % 2 === 0) continue;
      const wx = tx * T + 6, wy = y + roofH + 6;
      g.fillStyle(outline, 1).fillRect(wx - 2, wy - 2, 24, 16);
      g.fillStyle(0x88c8f0, 1).fillRect(wx, wy, 20, 12);
      g.fillStyle(0xd8f0ff, 1).fillRect(wx + 2, wy + 2, 6, 4);
      g.fillStyle(outline, 1).fillRect(wx + 9, wy, 2, 12);
    }
    // Door
    const dx = b.door.x * T, dy = b.door.y * T;
    g.fillStyle(outline, 1).fillRect(dx + 5, dy + 6, 22, 26);
    g.fillStyle(0x8a5a3a, 1).fillRect(dx + 7, dy + 8, 18, 24);
    g.fillStyle(0x6a4028, 1).fillRect(dx + 15, dy + 8, 2, 24);
    g.fillStyle(0xf0d070, 1).fillRect(dx + 20, dy + 20, 2, 2);
    // Name plaque
    const plaqueY = y + roofH - 12;
    this.scene.add.text(x + w / 2, plaqueY, b.label, {
      fontFamily: "monospace", fontSize: "9px", color: "#3a2a20", backgroundColor: "#f6ecd0", padding: { x: 4, y: 1 },
    }).setOrigin(0.5).setDepth(3).setResolution(2);
  }

  private spawnNpc(def: NpcDef, defeated: boolean) {
    const pos = defeated && def.moveToWhenDefeated ? def.moveToWhenDefeated : def;
    const texture = ensureCharacterTexture(this.scene, def.look);
    const sprite = this.scene.add.sprite(pos.x * TILE_SIZE + 16, pos.y * TILE_SIZE + 16, texture, 0).setDepth(10 + pos.y);
    setCharacterFrame(sprite, def.facing, 0);
    const label = this.scene.add.text(pos.x * TILE_SIZE + 16, pos.y * TILE_SIZE - 6, def.name, {
      fontFamily: "monospace", fontSize: "8px", color: "#ffffff", backgroundColor: "#1d3324cc", padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(40).setResolution(2);
    this.npcs.push({ def, x: pos.x, y: pos.y, sprite, label });
  }

  private drawExitMarkers() {
    for (const e of this.def.exits) {
      this.scene.add.text(e.x * TILE_SIZE + 16, e.y * TILE_SIZE - 4, `${e.toName} →`, {
        fontFamily: "monospace", fontSize: "8px", color: "#fff6d0", backgroundColor: "#4a3420", padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 1).setDepth(40).setResolution(2);
    }
  }
}

/** Shared by player & NPCs: pick the right frame from a character sheet. */
export function setCharacterFrame(sprite: Phaser.GameObjects.Sprite, dir: Direction, pose: 0 | 1 | 2) {
  const base = dir === "right" ? CHAR_FRAME.left : CHAR_FRAME[dir];
  sprite.setFrame(base + pose);
  sprite.setFlipX(dir === "right");
}

export { key as tileKey };
