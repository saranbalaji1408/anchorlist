/** A chat message with a fixed rendered height. */
export interface Item {
  id: string
  height: number
}

/** Deterministic PRNG (mulberry32), so every library gets the same items. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `n` items with ids `${prefix}${i}` and heights from 40 to 160 px, all far from the 100 px estimate. */
export function makeItems(n: number, prefix: string, random: () => number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, height: 40 + Math.round(random() * 120) }))
}

/** Every library is given this estimate for unmeasured rows (where it takes one). */
export const ESTIMATE = 100
/** Scroll container size in px. */
export const HEIGHT = 600
export const WIDTH = 420
