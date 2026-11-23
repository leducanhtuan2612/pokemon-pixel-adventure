import Phaser from "phaser";

const TILE = 32;
const MAP_W = 20;
const MAP_H = 13;

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private moving = false;

  constructor() { super("OverworldScene"); }

  create() {
    const graphics = this.add.graphics();
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const edge = x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1;
      const path = (y > 4 && y < 8 && x > 1 && x < 18) || (x > 8 && x < 12 && y > 1 && y < 11);
      const color = edge ? 0x244b37 : path ? 0xb9a36b : ((x + y) % 3 ? 0x4c9859 : 0x43894f);
      graphics.fillStyle(color, 1).fillRect(x * TILE, y * TILE, TILE, TILE);
      graphics.lineStyle(1, 0x203d2c, 0.18).strokeRect(x * TILE, y * TILE, TILE, TILE);
    }
    // A small landmark and trees make the first area readable without external assets.
    this.add.rectangle(320, 104, 76, 48, 0x477cce).setStrokeStyle(3, 0x244c87);
    this.add.text(320, 104, "POND", { fontFamily: "monospace", fontSize: "12px", color: "#eaf5ff" }).setOrigin(0.5);
    for (const [x, y] of [[100,95],[150,300],[500,90],[540,280],[70,270],[570,170]]) {
      this.add.circle(x, y, 18, 0x285638).setStrokeStyle(3, 0x1a402b);
      this.add.circle(x, y - 5, 12, 0x3e8050);
    }
    this.player = this.add.rectangle(320, 230, 20, 24, 0xf4d35e).setStrokeStyle(3, 0x493a20).setDepth(10);
    this.add.rectangle(320, 237, 12, 6, 0x4a78d0).setDepth(11);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,ENTER,SPACE,ESC") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-ENTER", () => this.interact());
    this.input.keyboard!.on("keydown-SPACE", () => this.interact());
    this.input.keyboard!.on("keydown-ESC", () => this.showToast("Menu sẽ được bổ sung ở bản tiếp theo"));
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.35);
    this.events.emit("ready");
    window.addEventListener("game:start", this.onStart);
  }

  private onStart = () => this.showToast("Chào mừng đến Pixel Forest!");

  private interact() { this.showToast("Bạn đang ở Pixel Forest — hãy tiếp tục khám phá!"); }
  private showToast(message: string) {
    const toast = this.add.text(320, 24, message, { fontFamily: "monospace", fontSize: "12px", color: "#ffffff", backgroundColor: "#14231ddd", padding: { x: 10, y: 8 } }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.time.delayedCall(1800, () => toast.destroy());
  }

  update(_time: number, delta: number) {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    if (this.moving) return;
    let dx = left ? -1 : right ? 1 : 0;
    let dy = up ? -1 : down ? 1 : 0;
    if (dx && dy) { if (this.keys.A.isDown || this.keys.D.isDown) dy = 0; else dx = 0; }
    if (!dx && !dy) return;
    const nx = this.player.x + dx * TILE;
    const ny = this.player.y + dy * TILE;
    if (nx < TILE || nx > (MAP_W - 2) * TILE || ny < TILE || ny > (MAP_H - 2) * TILE) return;
    this.moving = true;
    this.tweens.add({ targets: this.player, x: nx, y: ny, duration: Math.max(70, 125 - delta * 0.15), onComplete: () => { this.moving = false; } });
  }

  shutdown() { window.removeEventListener("game:start", this.onStart); }
}
