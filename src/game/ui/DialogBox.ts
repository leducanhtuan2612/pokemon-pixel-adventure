import Phaser from "phaser";

export const UI_FONT = '"VT323", monospace';
const W = 612, H = 86;

/**
 * FireRed-style text box at the bottom of the screen with typewriter text,
 * an optional speaker tab and a bouncing ▼ prompt. Advance with Z / Enter /
 * Space or a click/tap anywhere.
 */
export class DialogBox {
  private container: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private nameTab: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private nameBg: Phaser.GameObjects.Graphics;
  private pages: string[] = [];
  private index = 0;
  private onDone?: () => void;
  private typing?: Phaser.Time.TimerEvent;
  private fullText = "";

  constructor(private scene: Phaser.Scene, onClick?: () => void) {
    const x = (scene.scale.width - W) / 2, y = scene.scale.height - H - 8;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(3, 4, W, H, 10);
    g.fillStyle(0x484858, 1).fillRoundedRect(0, 0, W, H, 10);
    g.fillStyle(0xf8f8f8, 1).fillRoundedRect(4, 4, W - 8, H - 8, 7);
    g.lineStyle(2, 0x98a8c8, 1).strokeRoundedRect(9, 9, W - 18, H - 18, 5);
    this.text = scene.add.text(26, 14, "", {
      fontFamily: UI_FONT, fontSize: "26px", color: "#404048", wordWrap: { width: W - 64 }, lineSpacing: 0,
      shadow: { offsetX: 2, offsetY: 2, color: "#d8d0c8", fill: true },
    });
    this.arrow = scene.add.text(W - 34, H - 34, "▼", { fontFamily: UI_FONT, fontSize: "22px", color: "#e04848" });
    scene.tweens.add({ targets: this.arrow, y: H - 30, yoyo: true, repeat: -1, duration: 320 });
    this.nameBg = scene.add.graphics();
    this.nameText = scene.add.text(14, 3, "", { fontFamily: UI_FONT, fontSize: "22px", color: "#ffffff" });
    this.nameTab = scene.add.container(14, -24, [this.nameBg, this.nameText]).setVisible(false);
    const hit = scene.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => onClick?.());
    this.container = scene.add.container(x, y, [g, this.text, this.arrow, this.nameTab, hit]).setScrollFactor(0).setDepth(2000).setVisible(false);
  }

  get isOpen() { return this.container.visible; }

  open(pages: string[], onDone?: () => void, speaker?: string) {
    if (!pages.length) { onDone?.(); return; }
    this.pages = pages;
    this.index = 0;
    this.onDone = onDone;
    if (speaker) {
      this.nameText.setText(speaker);
      const w = this.nameText.width + 28;
      this.nameBg.clear().fillStyle(0x484858, 1).fillRoundedRect(0, 0, w, 30, 7).fillStyle(0x5878b8, 1).fillRoundedRect(3, 3, w - 6, 24, 5);
      this.nameTab.setVisible(true);
    } else this.nameTab.setVisible(false);
    this.container.setVisible(true);
    this.show();
  }

  /** Returns true if the key press was consumed. */
  advance(): boolean {
    if (!this.isOpen) return false;
    if (this.typing) { this.finishTyping(); return true; }
    this.index++;
    if (this.index >= this.pages.length) {
      this.container.setVisible(false);
      const done = this.onDone;
      this.onDone = undefined;
      done?.();
    } else this.show();
    return true;
  }

  private show() {
    this.fullText = this.pages[this.index];
    this.arrow.setVisible(false);
    this.text.setText("");
    let i = 0;
    this.typing?.remove(false);
    this.typing = this.scene.time.addEvent({
      delay: 16, repeat: this.fullText.length - 1,
      callback: () => { i++; this.text.setText(this.fullText.slice(0, i)); if (i >= this.fullText.length) this.finishTyping(); },
    });
  }

  private finishTyping() {
    this.typing?.remove(false);
    this.typing = undefined;
    this.text.setText(this.fullText);
    this.arrow.setVisible(true);
  }
}

/** Location banner that slides in at the top-left when entering a map. */
export function showLocationBanner(scene: Phaser.Scene, name: string) {
  const t = scene.add.text(18, 10, name, { fontFamily: UI_FONT, fontSize: "26px", color: "#403828" });
  const w = t.width + 36;
  const g = scene.add.graphics();
  g.fillStyle(0x6a4a2a, 1).fillRoundedRect(0, 0, w, 48, 6);
  g.fillStyle(0xf8ecc8, 1).fillRoundedRect(4, 4, w - 8, 40, 4);
  g.lineStyle(2, 0xc8a870, 1).strokeRoundedRect(8, 8, w - 16, 32, 3);
  const c = scene.add.container(12, -60, [g, t]).setScrollFactor(0).setDepth(1900);
  scene.tweens.add({ targets: c, y: 12, duration: 350, ease: "Back.easeOut", hold: 2200, yoyo: true, onComplete: () => c.destroy() });
}
