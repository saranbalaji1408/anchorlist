import type { Item } from './driver'

/** Deterministic PRNG (mulberry32). */
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

/** `count` items `prefix0..` with random heights in `[min, max]`. */
export function makeItems(count: number, prefix: string, random: () => number, min = 20, max = 400): Item[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, height: Math.round(min + random() * (max - min)) }))
}

const WORDS = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa'.split(' ')

/** `count` items with wrapping text and no fixed height, so their height depends on the width. */
export function makeTextItems(count: number, prefix: string, random: () => number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`,
    text: Array.from({ length: 3 + Math.floor(random() * 60) }, () => WORDS[Math.floor(random() * WORDS.length)]).join(' '),
  }))
}
