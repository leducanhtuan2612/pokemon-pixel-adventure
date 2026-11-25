import Phaser from "phaser";
import { ruleFor } from "./tiles";
import {
  BUILDING_OVERHANG, CHAR_FRAME, E, N, NE, NW, PROP, S, SE, SW, TILE_SIZE, W, WINDMILL_OVERHANG,
  buildAtlas, ensureBuildingTexture, ensureCharacterTexture, ensurePropTextures, ISO_TILE_W, ISO_TILE_H,
} from "./TilesetFactory";
import { DIR_VECTORS, type BuildingDef, type Direction, type ExitDef, type MapDefinition, type MapItemDef, type NpcDef, type Point, type SignDef } from "./types";
import { spriteKey } from "../battle/sprites";

const key = (x: number, y: number) => `${x},${y}`;
const T = TILE_SIZE;

export interface NpcRuntime {
  def: NpcDef; x: number; y: number; home: Point; facing: Direction; moving: boolean;
  sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image;
}

interface AnimatedCell { sprite: Phaser.GameObjects.Image; frames: number[] }

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
  private groundSprites: Phaser.GameObjects.Image[] = [];
  private animated: AnimatedCell[] = [];
  private animTick = 0;
  private grassFront?: Phaser.GameObjects.Image;
  private itemSprites = new Map<string, Phaser.GameObjects.Image>();
  private picked = new Set<string>();

  constructor(private scene: Phaser.Scene, readonly def: MapDefinition) {
    this.height = def.layout.length;
    this.width = def.layout[0]?.length ?? 0;
    const bad = def.layout.findIndex((r) => r.length !== this.width);
    if (bad >= 0) throw new Error(`Map ${def.id}: row ${bad} has ${def.layout[bad].length} tiles, expected ${this.width}`);
  }

  get pixelWidth() { return (this.width + this.height) * ISO_TILE_W / 2; }
  get pixelHeight() { return (this.width + this.height) * ISO_TILE_H / 2; }
  project(x: number, y: number): Point { return { x: (x - y + this.height) * ISO_TILE_W / 2, y: (x + y) * ISO_TILE_H / 2 }; }
  /** Convert camera world coordinates back to the nearest logical isometric tile. */
  unproject(screenX: number, screenY: number): Point {
    const u = screenX / (ISO_TILE_W / 2) - this.height;
    const v = screenY / (ISO_TILE_H / 2);
    return { x: Math.round((u + v) / 2), y: Math.round((v - u) / 2) };
  }

  charAt(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return "T";
    return this.def.layout[y][x];
  }

  npcAt(x: number, y: number) { return this.npcs.find((n) => n.x === x && n.y === y); }
  signAt(x: number, y: number): SignDef | undefined { return this.def.signs.find((s) => s.x === x && s.y === y); }
  doorAt(x: number, y: number): BuildingDef | undefined { return this.def.buildings.find((b) => b.door.x === x && b.door.y === y); }
  exitAt(x: number, y: number): ExitDef | undefined { return this.def.exits.find((e) => e.x === x && e.y === y); }
  /** Item (visible or hidden) at a tile that hasn't been collected yet. */
  itemAt(x: number, y: number): MapItemDef | undefined {
    return this.def.items?.find((i) => i.x === x && i.y === y && !this.picked.has(i.id));
  }
  removeItem(id: string) { this.picked.add(id); this.itemSprites.get(id)?.destroy(); this.itemSprites.delete(id); }
  isBlocked(x: number, y: number) {
    const item = this.itemAt(x, y);
    return ruleFor(this.charAt(x, y)).solid || !!this.npcAt(x, y) || (!!item && !item.hidden);
  }
  isEncounterTile(x: number, y: number) { return !!ruleFor(this.charAt(x, y)).encounter; }

  build(defeated: readonly string[], picked: readonly string[] = []) {
    ensurePropTextures(this.scene);
    picked.forEach((id) => this.picked.add(id));
    this.buildGround();
    this.placeProps();
    this.placeFireflies();
    for (const b of this.def.buildings) {
      const tex = ensureBuildingTexture(this.scene, b);
      const windmill = b.style === "windmill";
      const footprint = this.project(b.x + b.w - 1, b.y + b.h - 1);
      const width = (b.w + b.h) * ISO_TILE_W / 2;
      const depth = depthFor(b.x + b.y + b.w + b.h - 2, 0.7);
      this.scene.add.image(footprint.x, footprint.y - (windmill ? WINDMILL_OVERHANG : BUILDING_OVERHANG), tex).setDisplaySize(width, b.h * T + BUILDING_OVERHANG).setOrigin(0.5, 1).setDepth(depth);
      if (windmill) {
        const blades = this.scene.add.image(footprint.x, footprint.y - WINDMILL_OVERHANG + 25, PROP.blades).setDepth(depth + 0.01);
        this.scene.tweens.add({ targets: blades, angle: 360, duration: 9000, repeat: -1 });
      }
    }
    for (const it of this.def.items ?? []) {
      if (it.hidden || this.picked.has(it.id)) continue;
      const p = this.project(it.x, it.y);
      this.itemSprites.set(it.id, this.scene.add.image(p.x, p.y - 3, PROP.itemBall).setOrigin(0.5, 0.5).setDepth(depthFor(it.x + it.y, 0.2)));
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
    const p = this.project(tile.x, tile.y);
    g.setPosition(p.x - ISO_TILE_W / 2, p.y - ISO_TILE_H / 2).setScale(2, 1).setDepth(depth + 0.05).setVisible(true);
    if (!rustle) return;
    this.scene.tweens.add({ targets: g, y: g.y - 2, duration: 70, yoyo: true, repeat: 1 });
    for (let i = 0; i < 3; i++) {
      const leaf = this.scene.add.image(tile.x * T + 8 + i * 8, tile.y * T + 18, PROP.leaf).setDepth(depth + 0.1);
      this.scene.tweens.add({ targets: leaf, x: leaf.x + (i - 1) * 10, y: leaf.y - 10 - i * 3, alpha: 0, angle: 90, duration: 380, onComplete: () => leaf.destroy() });
    }
  }

  moveNpc(n: NpcRuntime, to: Point) {
    n.x = to.x; n.y = to.y;
    const p = this.project(to.x, to.y), x = p.x, y = p.y;
    this.scene.tweens.add({ targets: n.sprite, x, y, duration: 300 });
    this.scene.tweens.add({ targets: n.shadow, x, y: y + 13, duration: 300 });
    n.sprite.setDepth(depthFor(to.x + to.y, 0.5));
    n.shadow.setDepth(depthFor(to.x + to.y, 0.1));
  }

  faceNpc(n: NpcRuntime, dir: Direction) {
    n.facing = dir;
    if (n.def.role === "critter") n.sprite.setFlipX(dir === "right");
    else setCharacterFrame(n.sprite, dir, 0);
  }

  /** Walks an NPC one tile with a walk cycle. Resolves false if the tile is blocked. */
  stepNpc(n: NpcRuntime, dir: Direction, player: Point, ms = 300): Promise<boolean> {
    const v = DIR_VECTORS[dir], nx = n.x + v.x, ny = n.y + v.y;
    this.faceNpc(n, dir);
    if (n.moving || this.isBlocked(nx, ny) || (nx === player.x && ny === player.y)) return Promise.resolve(false);
    n.moving = true;
    n.x = nx; n.y = ny;
    const critter = n.def.role === "critter";
    if (!critter) setCharacterFrame(n.sprite, dir, Math.random() < 0.5 ? 1 : 2);
    if (dy(v) > 0 || v.x !== 0) n.sprite.setDepth(depthFor(nx + ny, 0.5));
    return new Promise((res) => {
      this.scene.tweens.add({
        targets: n.sprite, x: this.project(nx, ny).x, y: this.project(nx, ny).y - (critter ? 4 : 0), duration: ms,
        onUpdate: (tw) => {
          n.shadow.setPosition(n.sprite.x, n.sprite.y + (critter ? 10 : 13));
          if (critter) n.sprite.y = Phaser.Math.Linear(n.sprite.y, n.sprite.y, 1) - Math.sin(tw.progress * Math.PI) * 0.6;
          else if (tw.progress > 0.55) setCharacterFrame(n.sprite, dir, 0);
        },
        onComplete: () => {
          n.moving = false;
          n.sprite.setDepth(depthFor(nx + ny, 0.5));
          n.shadow.setDepth(depthFor(nx + ny, 0.1));
          res(true);
        },
      });
    });
  }

  /** Can an NPC wander onto this tile (stays near home, avoids grass/doors/exits)? */
  canWander(n: NpcRuntime, dir: Direction) {
    const v = DIR_VECTORS[dir], nx = n.x + v.x, ny = n.y + v.y, r = n.def.wander ?? 0;
    const ch = this.charAt(nx, ny);
    return Math.abs(nx - n.home.x) <= r && Math.abs(ny - n.home.y) <= r && ch !== ":" && ch !== "E" && ch !== "b";
  }

  /** Tiles a trainer can see: straight ahead until something solid. */
  sightLine(n: NpcRuntime): Point[] {
    const v = DIR_VECTORS[n.facing], out: Point[] = [];
    for (let i = 1; i <= (n.def.sight ?? 0); i++) {
      const x = n.x + v.x * i, y = n.y + v.y * i;
      if (ruleFor(this.charAt(x, y)).solid || this.npcAt(x, y)) break;
      out.push({ x, y });
    }
    return out;
  }

  /** Floating "!" over an NPC, removed after `ms`. */
  exclaim(n: NpcRuntime, ms = 700) {
    const b = this.scene.add.image(n.sprite.x, n.sprite.y - 30, PROP.bubble).setDepth(60).setScale(0);
    this.scene.tweens.add({ targets: b, scale: 1, duration: 160, ease: "Back.easeOut" });
    this.scene.time.delayedCall(ms, () => b.destroy());
  }

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
      case "M": return [`moss:${h % 7}`];
      case "=": case "E": return [`path:${this.mask8(x, y, (c) => c === "=" || c === "E" || c === "D")}:${h % 7}`];
      case "s": return [`sand:${this.mask8(x, y, (c) => c === "s" || c === "~")}:${h % 5}`];
      case "~": { const m = this.mask8(x, y, (c) => c === "~"); return [0, 1, 2].map((f) => `water:${m}:${f}:${(x + y * 2) % 3}`); }
      case "C": return [`cliff:${this.mask8(x, y, (c) => c === "C") & 15}:${y % 2}`];
      case "f": return ["crops"];
      case "v": return ["cabbage"];
      case "b": return ["bridge"];
      default: return [`ground:${h % 6 === 0 ? 1 : 0}`];
    }
  }

  private buildGround() {
    const cells: string[][][] = this.def.layout.map((row, y) => [...row].map((_, x) => this.descriptorsAt(x, y)));
    const unique = [...new Set(cells.flat(2))], atlasKey = `atlas-${this.def.id}`;
    const index = buildAtlas(this.scene, atlasKey, unique);
    cells.forEach((row, y) => row.forEach((descriptors, x) => {
      const p = this.project(x, y), frame = index.get(descriptors[0])!;
      const tile = this.scene.add.image(p.x, p.y, atlasKey, String(frame)).setDepth(-2);
      this.groundSprites.push(tile);
      if (descriptors.length > 1) this.animated.push({ sprite: tile, frames: descriptors.map((d) => index.get(d)!) });
    }));
  }

  private animate() {
    this.animTick++;
    for (const c of this.animated) {
      const f = c.frames.length === 2 ? Math.floor(this.animTick / 2) % 2 : this.animTick % c.frames.length;
      c.sprite.setFrame(String(f));
    }
  }

  /** Ambient fireflies and motes make flower patches and the hidden grove feel alive. */
  private placeFireflies() {
    let count = 0;
    for (let y = 2; y < this.height - 1; y++) for (let x = 2; x < this.width - 1; x++) {
      const ch = this.charAt(x, y);
      const seed = Math.abs((x * 31 + y * 17) % 13);
      if (!(ch === "*" || ch === "M" || ch === ":") || seed > 2 || count >= 28) continue;
      const p = this.project(x, y);
      const mote = this.scene.add.image(p.x + (seed - 6) * 2, p.y - 5 + (seed % 2) * 5, PROP.firefly)
        .setBlendMode(Phaser.BlendModes.ADD).setScale(0.45 + seed * 0.12).setAlpha(0.25).setDepth(2 + (seed % 2) * 0.1);
      this.scene.tweens.add({ targets: mote, y: mote.y - 4 - seed, alpha: 0.85, scale: mote.scale * 1.45, duration: 850 + seed * 170, yoyo: true, repeat: -1, delay: seed * 120 });
      count++;
    }
  }

  private placeProps() {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const ch = this.charAt(x, y), p = this.project(x, y), left = p.x - T / 2, top = p.y - T / 2;
      const d = depthFor(x + y, 0.2);
      if (ch === "T") this.scene.add.image(p.x, p.y + 16, PROP.tree).setOrigin(0.5, 1).setDepth(d + 0.4);
      else if (ch === "R") this.scene.add.image(left, top, PROP.rock).setOrigin(0, 0).setDepth(d);
      else if (ch === "S") this.scene.add.image(left, top, PROP.sign).setOrigin(0, 0).setDepth(d);
      else if (ch === "F") this.scene.add.image(left, top, PROP.fence).setOrigin(0, 0).setDepth(d);
      else if (ch === "Y") this.scene.add.image(p.x, p.y + 16, PROP.apple).setOrigin(0.5, 1).setDepth(d + 0.4);
      else if (ch === "h") this.scene.add.image(left, top, PROP.hedge).setOrigin(0, 0).setDepth(d);
      else if (ch === "W") this.scene.add.image(left, top, PROP.well).setOrigin(0, 0).setDepth(d);
      else if (ch === "n") this.scene.add.image(left, top, PROP.bench).setOrigin(0, 0).setDepth(d);
      else if (ch === "m") this.scene.add.image(left, top, PROP.mailbox).setOrigin(0, 0).setDepth(d);
      else if (ch === "l") this.scene.add.image(left, top, PROP.lamp).setOrigin(0, 0).setDepth(d + 0.4);
      else if (ch === "Q") {
        const aura = this.scene.add.image(p.x, p.y - 4, PROP.firefly).setBlendMode(Phaser.BlendModes.ADD).setScale(2.8).setAlpha(0.65).setDepth(d);
        this.scene.tweens.add({ targets: aura, alpha: 0.25, scale: 3.4, duration: 1250, yoyo: true, repeat: -1 });
        const crystal = this.scene.add.image(p.x, p.y + 16, PROP.crystal).setOrigin(0.5, 1).setDepth(d + 0.4);
        this.scene.tweens.add({ targets: crystal, y: crystal.y - 2, alpha: 0.88, duration: 900, yoyo: true, repeat: -1 });
      }
    }
  }

  private spawnNpc(def: NpcDef, defeated: boolean) {
    const pos = defeated && def.moveToWhenDefeated ? def.moveToWhenDefeated : def;
    const p = this.project(pos.x, pos.y), x = p.x, y = p.y;
    const critter = def.role === "critter";
    const shadow = this.scene.add.image(x, y + (critter ? 10 : 13), PROP.shadow).setDepth(depthFor(pos.x + pos.y, 0.1)).setScale(critter ? 0.8 : 1);
    const sprite = critter
      ? this.scene.add.sprite(x, y - 4, spriteKey(def.speciesId ?? "pidgey", "front")).setScale(1.5).setDepth(depthFor(pos.x + pos.y, 0.5))
      : this.scene.add.sprite(x, y, ensureCharacterTexture(this.scene, def.look), 0).setDepth(depthFor(pos.x + pos.y, 0.5));
    const n: NpcRuntime = { def, x: pos.x, y: pos.y, home: { x: pos.x, y: pos.y }, facing: def.facing, moving: false, sprite, shadow };
    this.faceNpc(n, def.facing);
    if (critter) this.scene.tweens.add({ targets: sprite, scaleY: 1.6, duration: 500 + Math.random() * 300, yoyo: true, repeat: -1 });
    this.npcs.push(n);
  }
}

const dy = (v: Point) => v.y;

/** Shared by player & NPCs: pick the right frame from a character sheet. */
export function setCharacterFrame(sprite: Phaser.GameObjects.Sprite, dir: Direction, pose: 0 | 1 | 2) {
  const base = dir === "right" ? CHAR_FRAME.left : CHAR_FRAME[dir];
  sprite.setFrame(base + pose);
  sprite.setFlipX(dir === "right");
}

export { key as tileKey };
