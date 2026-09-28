/**
 * High-quality seedable pseudo-random number generator (Mulberry32)
 * Ensures 100% reproducible puzzles across devices, seeds, and sessions.
 */

export class PRNG {
  private s: number;

  constructor(seed: number | string = Date.now()) {
    this.s = typeof seed === 'string' ? PRNG.hashString(seed) : (seed >>> 0);
    if (this.s === 0) this.s = 1;
  }

  /**
   * Hashes any string into a 32-bit unsigned integer using FNV-1a & Murmur mixer.
   */
  public static hashString(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // Avalanching finalizer
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  /**
   * Returns next pseudo-random floating point number in [0, 1)
   */
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns pseudo-random integer in [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    if (min >= max) return min;
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }

  /**
   * Random boolean with given probability of true (default 0.5)
   */
  public nextBool(prob = 0.5): boolean {
    return this.next() < prob;
  }

  /**
   * In-place Fisher-Yates shuffle using this seeded PRNG
   */
  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  /**
   * Pick random item from array
   */
  public pick<T>(array: readonly T[]): T {
    const idx = this.nextInt(0, array.length - 1);
    return array[idx];
  }

  public getSeed(): number {
    return this.s >>> 0;
  }
}
