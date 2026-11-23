import Phaser from "phaser";
import { TILE_SIZE, ensureCharacterTexture } from "../world/TilesetFactory";
import { DIR_VECTORS, type Direction, type Point } from "../world/types";
import { setCharacterFrame, type WorldMap } from "../world/WorldMap";

const STEP_MS = 190;      // time to cross one tile
const TURN_GRACE_MS = 90; // tap to turn in place, hold to walk (classic feel)

/**
 * Grid-locked four-direction movement with a smooth tween between tiles.
 * Knows nothing about battles, NPC dialog or encounters — it reports steps
 * through `onStep` and the scene decides what happens.
 */
export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;
  tile: Point;
  facing: Direction = "down";
  locked = false;
  onStep?: (tile: Point) => void;

  private moving = false;
  private stride: 1 | 2 = 1;
  private heldDir: Direction | null = null;
  private heldSince = 0;
  private turnedThisHold = false;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  constructor(private scene: Phaser.Scene, private world: WorldMap, start: Point) {
    this.tile = { ...start };
    const texture = ensureCharacterTexture(scene, "player");
    this.sprite = scene.add.sprite(start.x * TILE_SIZE + 16, start.y * TILE_SIZE + 16, texture, 0);
    this.sprite.setDepth(10 + start.y + 0.5);
    setCharacterFrame(this.sprite, this.facing, 0);
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as PlayerController["wasd"];
  }

  get isMoving() { return this.moving; }

  facingTile(): Point {
    const v = DIR_VECTORS[this.facing];
    return { x: this.tile.x + v.x, y: this.tile.y + v.y };
  }

  face(dir: Direction) { this.facing = dir; setCharacterFrame(this.sprite, dir, 0); }

  teleport(p: Point, dir: Direction = this.facing) {
    this.scene.tweens.killTweensOf(this.sprite);
    this.moving = false;
    this.tile = { ...p };
    this.sprite.setPosition(p.x * TILE_SIZE + 16, p.y * TILE_SIZE + 16).setDepth(10 + p.y + 0.5);
    this.face(dir);
  }

  update(time: number) {
    if (this.moving) return;
    const dir = this.readInput();
    if (!dir || this.locked) { this.heldDir = null; return; }

    if (dir !== this.heldDir) { this.heldDir = dir; this.heldSince = time; this.turnedThisHold = false; }
    if (dir !== this.facing) {
      this.face(dir);
      this.turnedThisHold = true;
      return; // a quick tap only turns; keep holding to walk
    }
    if (this.turnedThisHold && time - this.heldSince < TURN_GRACE_MS) return;
    this.tryStep(dir);
  }

  private readInput(): Direction | null {
    const c = this.cursors, k = this.wasd;
    if (c.up.isDown || k.W.isDown) return "up";
    if (c.down.isDown || k.S.isDown) return "down";
    if (c.left.isDown || k.A.isDown) return "left";
    if (c.right.isDown || k.D.isDown) return "right";
    return null;
  }

  private tryStep(dir: Direction) {
    const v = DIR_VECTORS[dir];
    const nx = this.tile.x + v.x, ny = this.tile.y + v.y;
    if (this.world.isBlocked(nx, ny)) {
      setCharacterFrame(this.sprite, dir, 0);
      return;
    }
    this.moving = true;
    this.tile = { x: nx, y: ny };
    this.stride = this.stride === 1 ? 2 : 1;
    const stride = this.stride;
    setCharacterFrame(this.sprite, dir, stride);
    this.sprite.setDepth(10 + ny + 0.5);
    this.scene.tweens.add({
      targets: this.sprite,
      x: nx * TILE_SIZE + 16,
      y: ny * TILE_SIZE + 16,
      duration: STEP_MS,
      onUpdate: (tw) => { if (tw.progress > 0.55) setCharacterFrame(this.sprite, dir, 0); },
      onComplete: () => {
        this.moving = false;
        this.onStep?.(this.tile);
      },
    });
  }
}
