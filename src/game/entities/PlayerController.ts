import Phaser from "phaser";
import { PROP, ensureCharacterTexture } from "../world/TilesetFactory";
import { DIR_VECTORS, type Direction, type Point } from "../world/types";
import { depthFor, setCharacterFrame, type WorldMap } from "../world/WorldMap";

const STEP_MS = 145;
const INPUT_BUFFER_MS = 180;

/**
 * Responsive four-direction controller for the orthogonal top-down world.
 * A direction tap moves immediately; brief inputs made during a step are buffered.
 */
export class PlayerController {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private shift: Phaser.Input.Keyboard.Key;
  tile: Point;
  facing: Direction = "down";
  locked = false;
  onStep?: (tile: Point) => void;

  private moving = false;
  private stride: 1 | 2 = 1;
  private queuedDirection: Direction | null = null;
  private queueExpiresAt = 0;
  private virtualDirection: Direction | null = null;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  private onVirtualMove = (event: Event) => {
    const detail = (event as CustomEvent<{ dir?: Direction; pressed?: boolean }>).detail;
    if (!detail?.dir) return;
    this.virtualDirection = detail.pressed ? detail.dir : null;
  };

  constructor(private scene: Phaser.Scene, private world: WorldMap, start: Point) {
    this.tile = { ...start };
    const texture = ensureCharacterTexture(scene, "player");
    const p = this.world.project(start.x, start.y);
    this.shadow = scene.add.image(p.x, p.y + 13, PROP.shadow).setDepth(depthFor(start.y, 0.1));
    this.sprite = scene.add.sprite(p.x, p.y, texture, 0);
    this.sprite.setDepth(depthFor(start.y, 0.5));
    setCharacterFrame(this.sprite, this.facing, 0);
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as PlayerController["wasd"];
    this.shift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    window.addEventListener("game:virtual-move", this.onVirtualMove);
    scene.events.once("shutdown", () => window.removeEventListener("game:virtual-move", this.onVirtualMove));
    world.updateGrassOverlay(this.tile, this.sprite.depth, false);
  }

  get isMoving() { return this.moving; }

  facingTile(): Point {
    const v = DIR_VECTORS[this.facing];
    return { x: this.tile.x + v.x, y: this.tile.y + v.y };
  }

  face(dir: Direction) {
    this.facing = dir;
    setCharacterFrame(this.sprite, dir, 0);
  }

  teleport(p: Point, dir: Direction = this.facing) {
    this.scene.tweens.killTweensOf(this.sprite);
    this.moving = false;
    this.queuedDirection = null;
    this.tile = { ...p };
    const screen = this.world.project(p.x, p.y);
    this.sprite.setPosition(screen.x, screen.y).setDepth(depthFor(p.y, 0.5));
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 13).setDepth(depthFor(p.y, 0.1));
    this.face(dir);
    this.world.updateGrassOverlay(this.tile, this.sprite.depth, false);
  }

  update(time: number) {
    if (this.locked) {
      this.queuedDirection = null;
      return;
    }

    const dir = this.readInput();
    if (dir) {
      this.queuedDirection = dir;
      this.queueExpiresAt = time + INPUT_BUFFER_MS;
    } else if (time > this.queueExpiresAt) {
      this.queuedDirection = null;
    }

    if (this.moving) return;
    const next = dir ?? this.queuedDirection;
    if (!next) return;

    this.queuedDirection = null;
    if (next !== this.facing) this.face(next);
    this.tryStep(next);
  }

  private readInput(): Direction | null {
    if (this.virtualDirection) return this.virtualDirection;
    const c = this.cursors, k = this.wasd;
    if (c.up.isDown || k.W.isDown) return "up";
    if (c.down.isDown || k.S.isDown) return "down";
    if (c.left.isDown || k.A.isDown) return "left";
    if (c.right.isDown || k.D.isDown) return "right";
    return null;
  }

  /** Quest/click navigation: one collision-checked step without keyboard input. */
  autoStep(dir: Direction): boolean {
    if (this.moving) return false;
    this.queuedDirection = null;
    this.face(dir);
    return this.tryStep(dir);
  }

  private tryStep(dir: Direction): boolean {
    const v = DIR_VECTORS[dir];
    const nx = this.tile.x + v.x, ny = this.tile.y + v.y;
    if (this.world.isBlocked(nx, ny)) {
      setCharacterFrame(this.sprite, dir, 0);
      return false;
    }

    this.moving = true;
    this.tile = { x: nx, y: ny };
    this.stride = this.stride === 1 ? 2 : 1;
    const stride = this.stride;
    setCharacterFrame(this.sprite, dir, stride);
    const running = this.shift.isDown;

    if (v.y > 0 || v.x !== 0) this.sprite.setDepth(depthFor(ny, 0.5));
    this.world.updateGrassOverlay({ x: -99, y: -99 }, 0, false);

    const destination = this.world.project(nx, ny);
    this.scene.tweens.add({
      targets: this.sprite,
      x: destination.x,
      y: destination.y,
      duration: running ? STEP_MS * 0.58 : STEP_MS,
      onUpdate: (tw) => {
        if (tw.progress > 0.55) setCharacterFrame(this.sprite, dir, 0);
        this.shadow.setPosition(this.sprite.x, this.sprite.y + 13);
      },
      onComplete: () => {
        this.moving = false;
        this.sprite.setDepth(depthFor(ny, 0.5));
        this.shadow.setDepth(depthFor(ny, 0.1));
        this.world.updateGrassOverlay(this.tile, this.sprite.depth, true);
        this.onStep?.(this.tile);
      },
    });
    return true;
  }
}
