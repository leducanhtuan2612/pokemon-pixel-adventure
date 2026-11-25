type Track = "village" | "battle";
type Sfx = "step" | "pickup" | "encounter" | "attack" | "catch" | "victory" | "defeat";
const NOTES: Record<Track, number[]> = {
  village: [392, 494, 587, 494, 440, 523, 659, 523, 392, 494, 587, 784, 659, 587, 494, 440],
  battle: [330, 392, 494, 659, 587, 494, 392, 494, 349, 440, 523, 698, 659, 523, 440, 392],
};
const BASS: Record<Track, number[]> = {
  village: [98, 147, 110, 165, 98, 147, 123, 185],
  battle: [82, 123, 98, 147, 73, 110, 98, 147],
};

/** Original tiny chiptune + synthesized SFX. No external audio assets or licenses. */
class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private timer?: number;
  private track: Track = "village";
  private enabled = true;
  private unlocked = false;
  private lastStepAt = 0;

  constructor() {
    try { this.enabled = localStorage.getItem("ppa-audio") !== "off"; }
    catch { this.enabled = true; }
  }

  get isEnabled() { return this.enabled; }

  unlock() {
    if (typeof window === "undefined") return;
    try {
      if (!this.context) {
        const AudioCtor = window.AudioContext;
        if (!AudioCtor) return;
        this.context = new AudioCtor();
        this.master = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.62 : 0;
        this.musicBus.gain.value = 0.22;
        this.musicBus.connect(this.master);
        this.master.connect(this.context.destination);
      }
      this.unlocked = true;
      void this.context.resume().catch(() => undefined);
      if (this.enabled) this.startMusic();
    } catch {
      // Audio is optional: missing browser support must never break gameplay.
      this.unlocked = false;
    }
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    try { localStorage.setItem("ppa-audio", value ? "on" : "off"); } catch { /* storage unavailable */ }
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(value ? 0.62 : 0, now, 0.035);
    if (value) {
      void this.context.resume().catch(() => undefined);
      this.startMusic();
    } else this.stopMusic();
  }

  setTrack(track: Track) {
    if (this.track === track) return;
    this.track = track;
    if (this.enabled && this.unlocked) this.startMusic();
  }

  play(name: Sfx) {
    if (!this.enabled || !this.unlocked || !this.context || !this.master) return;
    const now = this.context.currentTime + 0.005;
    const tone = (frequency: number, offset: number, duration: number, wave: OscillatorType, volume: number, slide = 0) => {
      const osc = this.context!.createOscillator(), gain = this.context!.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(frequency, now + offset);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), now + offset + duration);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.linearRampToValueAtTime(volume, now + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      osc.connect(gain); gain.connect(this.master!);
      osc.start(now + offset); osc.stop(now + offset + duration + 0.02);
    };
    switch (name) {
      case "step":
        if (now * 1000 - this.lastStepAt < 105) return;
        this.lastStepAt = now * 1000;
        tone(180, 0, 0.035, "square", 0.018, -40); break;
      case "pickup":
        [660, 880, 1320].forEach((n, i) => tone(n, i * 0.07, 0.12, "square", 0.045)); break;
      case "encounter":
        [330, 440, 587, 784].forEach((n, i) => tone(n, i * 0.055, 0.15, "sawtooth", 0.038)); break;
      case "attack":
        tone(220, 0, 0.12, "square", 0.035, 160);
        tone(110, 0.02, 0.1, "triangle", 0.025, -45); break;
      case "catch":
        [523, 659, 784, 1047].forEach((n, i) => tone(n, i * 0.085, 0.18, "triangle", 0.045)); break;
      case "victory":
        [523, 659, 784, 1047, 1318].forEach((n, i) => tone(n, i * 0.11, 0.22, "square", 0.05)); break;
      case "defeat":
        [392, 330, 262, 196].forEach((n, i) => tone(n, i * 0.13, 0.25, "triangle", 0.045, -18)); break;
    }
  }

  private stopMusic() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private startMusic() {
    if (!this.context || !this.musicBus || !this.enabled || !this.unlocked) return;
    this.stopMusic();
    const ctx = this.context, notes = NOTES[this.track], bass = BASS[this.track];
    const beat = this.track === "battle" ? 0.145 : 0.18;
    const schedule = () => {
      if (!this.context || !this.musicBus || !this.enabled) return;
      const start = ctx.currentTime + 0.06;
      notes.forEach((frequency, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(frequency, start + i * beat);
        gain.gain.setValueAtTime(0.0001, start + i * beat);
        gain.gain.linearRampToValueAtTime(0.16, start + i * beat + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + i * beat + beat * 0.84);
        osc.connect(gain); gain.connect(this.musicBus!);
        osc.start(start + i * beat); osc.stop(start + i * beat + beat * 0.9);
        if (i % 2 === 0) {
          const bassOsc = ctx.createOscillator(), bassGain = ctx.createGain();
          bassOsc.type = "triangle";
          bassOsc.frequency.setValueAtTime(bass[(i / 2) % bass.length], start + i * beat);
          bassGain.gain.setValueAtTime(0.0001, start + i * beat);
          bassGain.gain.linearRampToValueAtTime(0.11, start + i * beat + 0.015);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, start + i * beat + beat * 1.6);
          bassOsc.connect(bassGain); bassGain.connect(this.musicBus!);
          bassOsc.start(start + i * beat); bassOsc.stop(start + i * beat + beat * 1.7);
        }
      });
      this.timer = window.setTimeout(schedule, notes.length * beat * 1000 - 80);
    };
    schedule();
  }
}
export const gameAudio = new GameAudio();
