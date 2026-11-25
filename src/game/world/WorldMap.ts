import Phaser from "phaser";
import { ruleFor } from "./tiles";
import {
  BUILDING_OVERHANG, CHAR_FRAME, E, N, NE, NW, PROP, S, SE, SW, TILE_SIZE, W,
  buildAtlas, ensureBuildingTexture, ensureCharacterTexture, ensurePropTextures,
} from "./TilesetFactory";
import type { BuildingDef, Direction, ExitDef, MapDefinition, NpcDef, Point, SignDef } from "./types";

const key = (x: number, y: number) => `${x},${y}`;
const T = TILE_SIZE;

export interface NpcRuntime { def: NpcDef; x: number; y: number; sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image }

interface AnimatedCell { x: number; y: number; frames: number[] }

/** Depth for y-sorted objects standing on tile row `y`. */
export const depthFor = (y: number, bias = 0) => 10 + y + bias;

/**
 * Runtime view of a MapDefinition: renders ground with a Phaser Tilemap built
 * from an on-the-fly autotiled atlas, places y-sorted props (2-tile trees,
 * buildings, fences…) and answers spatial questions for gameplay.
 */
export class WorldMap {
  readonly width: number;
  readonly height: number;
  readonly npcs: NpcRuntime[] = [];
  private tilemap?: Phaser.Tilemaps.Tilemap;
  private layer?: Phaser.Tilemaps.TilemapLayer;
  private animated: AnimatedCell[] = [];
  private animTick = 0;
  private grassFront?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, readonly def: MapDefinition) {
    this.height = def.layout.length;
    this.width = def.layout[0]?.length ?? 0;
    const bad = def.layout.findIndex((r) => r.length !== this.width);
    if (bad >= 0) throw new Error(`Map ${def.id}: row ${bad} has ${def.layout[bad].length} tiles, expected ${this.width}`);
  }

  get pixelWidth() { return this.width * T; }
  get pixelHeight() { return this.height * T; }

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

  build(defeated: readonly string[]) {
    ensurePropTextures(this.scene);
    this.buildGround();
    this.placeProps();
    for (const b of this.def.buildings) {
      const tex = ensureBuildingTexture(this.scene, b);
      this.scene.add.image(b.x * T, b.y * T - BUILDING_OVERHANG, tex).setOrigin(0, 0).setDepth(depthFor(b.y + b.h - 1, 0.7));
    }
    for (const def of this.def.npcs) this.spawnNpc(def, defeated.includes(def.id));
    this.grassFront = this.scene.add.image(0, 0, PROP.grassFront).setOrigin(0, 0).setVisible(false);
    this.scene.time.addEvent({ delay: 420, loop: true, callback: () => this.animate() });
  }

  destroy() { this.tilemap?.destroy(); }

  /** Shows the tall-grass blades in front of a character standing in grass (FireRed style). */
  updateGrassOverlay(tile: Point, depth: number, rustle: boolean) {
    const g = this.grassFront!;
    if (!this.isEncounterTile(tile.x, tile.y)) { g.setVisible(false); return; }
    g.setPosition(tile.x * T, tile.y * T).setDepth(depth + 0.05).setVisible(true);
    if (!rustle) return;
    this.scene.tweens.add({ targets: g, y: g.y - 2, duration: 70, yoyo: true, repeat: 1 });
    for (let i = 0; i < 3; i++) {
      const leaf = this.scene.add.image(tile.x * T + 8 + i * 8, tile.y * T + 18, PROP.leaf).setDepth(depth + 0.1);
      this.scene.tweens.add({ targets: leaf, x: leaf.x + (i - 1) * 10, y: leaf.y - 10 - i * 3, alpha: 0, angle: 90, duration: 380, onComplete: () => leaf.destroy() });
    }
  }

  moveNpc(n: NpcRuntime, to: Point) {
    n.x = to.x; n.y = to.y;
    const x = to.x * T + 16, y = to.y * T + 16;
    this.scene.tweens.add({ targets: n.sprite, x, y, duration: 300 });
    this.scene.tweens.add({ targets: n.shadow, x, y: y + 13, duration: 300 });
    n.sprite.setDepth(depthFor(to.y, 0.5));
  }

  faceNpc(n: NpcRuntime, dir: Direction) { setCharacterFrame(n.sprite, dir, 0); }

  /* ------------------------------------------------------------ */

  private mask8(x: number, y: number, same: (ch: string) => boolean) {
    const s = (dx: number, dy: number) => {
      const cx = x + dx, cy = y + dy;
      if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return true;
      return same(this.charAt(cx, cy));
    };
    return (s(0, -1) ? N : 0) | (s(1, 0) ? E : 0) | (s(0, 1) ? S : 0) | (s(-1, 0) ? W : 0)
      | (s(1, -1) ? NE : 0) | (s(1, 1) ? SE : 0) | (s(-1, 1) ? SW : 0) | (s(-1, -1) ? NW : 0);
  }

  /** Ground descriptors per cell; animated cells get one descriptor per frame. */
  private descriptorsAt(x: number, y: number): string[] {
    const ch = this.charAt(x, y), h = Math.abs((x * 73856093) ^ (y * 19349663));
    switch (ch) {
      case "*": return [0, 1].map((f) => `flower:${f}:${h % 3 === 0 ? 1 : 0}`);
      case ":": return ["tall"];
      case "=": case "E": return [`path:${this.mask8(x, y, (c) => c === "=" || c === "E" || c === "D")}:${h % 7}`];
      case "s": return [`sand:${this.mask8(x, y, (c) => c === "s" || c === "~")}:${h % 5}`];
      case "~": { const m = this.mask8(x, y, (c) => c === "~"); return [0, 1, 2].map((f) => `water:${m}:${f}:${(x + y * 2) % 3}`); }
      case "C": return [`cliff:${this.mask8(x, y, (c) => c === "C") & 15}:${y % 2}`];
      default: return [`ground:${h % 6 === 0 ? 1 : 0}`];
    }
  }

  private buildGround() {
    const cells: string[][][] = this.def.layout.map((row, y) => [...row].map((_, x) => this.descriptorsAt(x, y)));
    const unique = [...new Set(cells.flat(2))];
    const atlasKey = `atlas-${this.def.id}`;
    const index = buildAtlas(this.scene, atlasKey, unique);
    const data = cells.map((row) => row.map((d) => index.get(d[0])!));
    cells.forEach((row, y) => row.forEach((d, x) => { if (d.length > 1) this.animated.push({ x, y, frames: d.map((k) => index.get(k)!) }); }));
    this.tilemap = this.scene.make.tilemap({ data, tileWidth: T, tileHeight: T });
    const tileset = this.tilemap.addTilesetImage(atlasKey, atlasKey, T, T, 0, 0)!;
    this.layer = this.tilemap.createLayer(0, tileset, 0, 0)!.setDepth(0);
  }

  private animate() {
    this.animTick++;
    for (const c of this.animated) {
      const f = c.frames.length === 2 ? Math.floor(this.animTick / 2) % 2 : this.animTick % c.frames.length;
      this.layer?.putTileAt(c.frames[f], c.x, c.y);
    }
  }

  private placeProps() {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const ch = this.charAt(x, y);
      if (ch === "T") this.scene.add.image(x * T + 16, (y + 1) * T, PROP.tree).setOrigin(0.5, 1).setDepth(depthFor(y, 0.6));
      else if (ch === "R") this.scene.add.image(x * T, y * T, PROP.rock).setOrigin(0, 0).setDepth(depthFor(y, 0.2));
      else if (ch === "S") this.scene.add.image(x * T, y * T, PROP.sign).setOrigin(0, 0).setDepth(depthFor(y, 0.2));
      else if (ch === "F") this.scene.add.image(x * T, y * T, PROP.fence).setOrigin(0, 0).setDepth(depthFor(y, 0.2));
    }
  }

  private spawnNpc(def: NpcDef, defeated: boolean) {
    const pos = defeated && def.moveToWhenDefeated ? def.moveToWhenDefeated : def;
    const texture = ensureCharacterTexture(this.scene, def.look);
    const x = pos.x * T + 16, y = pos.y * T + 16;
    const shadow = this.scene.add.image(x, y + 13, PROP.shadow).setDepth(depthFor(pos.y, 0.1));
    const sprite = this.scene.add.sprite(x, y, texture, 0).setDepth(depthFor(pos.y, 0.5));
    setCharacterFrame(sprite, def.facing, 0);
    this.npcs.push({ def, x: pos.x, y: pos.y, sprite, shadow });
  }
}

/** Shared by player & NPCs: pick the right frame from a character sheet. */
export function setCharacterFrame(sprite: Phaser.GameObjects.Sprite, dir: Direction, pose: 0 | 1 | 2) {
  const base = dir === "right" ? CHAR_FRAME.left : CHAR_FRAME[dir];
  sprite.setFrame(base + pose);
  sprite.setFlipX(dir === "right");
}

export { key as tileKey };
