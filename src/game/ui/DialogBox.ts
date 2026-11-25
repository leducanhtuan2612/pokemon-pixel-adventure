import Phaser from "phaser";

const W = 600, H = 70;

/**
 * Classic bottom-of-screen text box. While open, the scene locks player
 * movement. Advance with Enter / Space / Z.
 */
export class DialogBox {
  private container: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private pages: string[] = [];
  private index = 0;
  private onDone?: () => void;
  private typing?: Phaser.Time.TimerEvent;
  private fullText = "";

  constructor(private scene: Phaser.Scene) {
    const x = (scene.scale.width - W) / 2, y = scene.scale.height - H - 10;
    const g = scene.add.graphics();
    g.fillStyle(0x2a3a48, 1).fillRoundedRect(0, 0, W, H, 8);
    g.fillStyle(0xf8f8f0, 1).fillRoundedRect(3, 3, W - 6, H - 6, 6);
    g.lineStyle(2, 0x6a90a8, 1).strokeRoundedRect(7, 7, W - 14, H - 14, 4);
    this.text = scene.add.text(20, 14, "", {
      fontFamily: "monospace", fontSize: "14px", color: "#30303a", wordWrap: { width: W - 50 }, lineSpacing: 4,
    }).setResolution(2);
    this.arrow = scene.add.text(W - 26, H - 26, "▼", { fontFamily: "monospace", fontSize: "12px", color: "#e04848" });
    scene.tweens.add({ targets: this.arrow, y: H - 22, yoyo: true, repeat: -1, duration: 350 });
    this.container = scene.add.container(x, y, [g, this.text, this.arrow]).setScrollFactor(0).setDepth(2000).setVisible(false);
  }

  get isOpen() { return this.container.visible; }

  open(pages: string[], onDone?: () => void) {
    if (!pages.length) { onDone?.(); return; }
    this.pages = pages;
    this.index = 0;
    this.onDone = onDone;
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
      delay: 18, repeat: this.fullText.length - 1,
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
