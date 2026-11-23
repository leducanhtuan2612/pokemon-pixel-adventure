/** Single place for randomness so it can be seeded for tests/replays later. */
export class RandomService {
  constructor(private next: () => number = Math.random) {}

  static seeded(seed: number) {
    let a = seed >>> 0;
    return new RandomService(() => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    });
  }

  float() { return this.next(); }
  chance(p: number) { return this.next() < p; }
  int(min: number, max: number) { return min + Math.floor(this.next() * (max - min + 1)); }

  weighted<T extends { weight: number }>(items: readonly T[]): T | undefined {
    const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, item.weight);
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }
}

export const random = new RandomService();
