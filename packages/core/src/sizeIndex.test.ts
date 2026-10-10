import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createSizeIndex, spliceSizes, type SizeIndex } from './sizeIndex'

/** Naive reference: an array of sizes. */
class Naive {
  sizes: number[] = []
  gap = 0
  padStart = 0
  padEnd = 0
  offsetOf(i: number): number {
    let s = this.padStart
    for (let j = 0; j < i; j++) s += this.sizes[j]! + this.gap
    return s
  }
  total(): number {
    const n = this.sizes.length
    return this.padStart + this.padEnd + this.sizes.reduce((a, b) => a + b, 0) + Math.max(0, n - 1) * this.gap
  }
  find(offset: number): number {
    const n = this.sizes.length
    if (!n) return -1
    let best = 0
    for (let i = 0; i < n; i++) if (this.offsetOf(i) <= offset) best = i
    return best
  }
}

type Cmd =
  | { t: 'prepend' | 'append'; sizes: number[] }
  | { t: 'trimStart' | 'trimEnd'; k: number }
  | { t: 'set'; i: number; size: number }
  | { t: 'splice'; at: number; remove: number; sizes: number[] }
  | { t: 'reset'; sizes: number[] }
  | { t: 'layout'; gap: number; padStart: number; padEnd: number }

const size = fc.oneof(fc.integer({ min: 0, max: 300 }), fc.double({ min: 0, max: 300, noNaN: true }))
const sizes = fc.array(size, { maxLength: 40 })
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ t: fc.constantFrom('prepend' as const, 'append' as const), sizes }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constantFrom('trimStart' as const, 'trimEnd' as const), k: fc.nat(30) }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant('set' as const), i: fc.nat(500), size }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('splice' as const), at: fc.nat(500), remove: fc.nat(10), sizes }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('reset' as const), sizes }) },
  {
    weight: 1,
    arbitrary: fc.record({ t: fc.constant('layout' as const), gap: fc.nat(20), padStart: fc.nat(50), padEnd: fc.nat(50) }),
  },
)

const apply = (index: SizeIndex, naive: Naive, c: Cmd): void => {
  const n = naive.sizes.length
  switch (c.t) {
    case 'prepend':
      index.prepend(c.sizes.length, (i) => c.sizes[i]!)
      naive.sizes.unshift(...c.sizes)
      break
    case 'append':
      index.append(c.sizes.length, (i) => c.sizes[i - n]!)
      naive.sizes.push(...c.sizes)
      break
    case 'trimStart':
    case 'trimEnd': {
      const k = Math.min(c.k, n)
      if (c.t === 'trimStart') {
        index.trimStart(k)
        naive.sizes.splice(0, k)
      } else {
        index.trimEnd(k)
        naive.sizes.splice(n - k, k)
      }
      break
    }
    case 'set':
      if (!n) break
      index.setSize(c.i % n, c.size)
      naive.sizes[c.i % n] = c.size
      break
    case 'splice': {
      const at = c.at % (n + 1)
      spliceSizes(index, at, c.remove, c.sizes.length, (i) => c.sizes[i - at]!)
      naive.sizes.splice(at, c.remove, ...c.sizes)
      break
    }
    case 'reset':
      index.reset(c.sizes.length, (i) => c.sizes[i]!)
      naive.sizes = [...c.sizes]
      break
    case 'layout':
      index.setLayout(c.gap, c.padStart, c.padEnd)
      naive.gap = c.gap
      naive.padStart = c.padStart
      naive.padEnd = c.padEnd
      break
  }
}

const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b))

describe('SizeIndex', () => {
  it('matches a naive array under random edits (property)', () => {
    fc.assert(
      fc.property(fc.array(cmd, { maxLength: 60 }), fc.array(fc.double({ min: -100, max: 20000, noNaN: true }), { maxLength: 10 }), (cmds, probes) => {
        const index = createSizeIndex()
        const naive = new Naive()
        for (const c of cmds) {
          apply(index, naive, c)
          expect(index.count).toBe(naive.sizes.length)
        }
        const n = naive.sizes.length
        expect(close(index.total(), naive.total())).toBe(true)
        for (let i = 0; i <= n; i++) expect(close(index.offsetOf(i), naive.offsetOf(i))).toBe(true)
        for (let i = 0; i < n; i++) expect(index.size(i)).toBe(naive.sizes[i])
        for (const p of [...probes, ...naive.sizes.map((_, i) => naive.offsetOf(i))]) {
          const got = index.findIndexAtOffset(p)
          const want = naive.find(p)
          // Equal, or a neighbour at the same offset (zero-size items, rounding).
          if (got !== want) expect(close(index.offsetOf(got), naive.offsetOf(want))).toBe(true)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('stays bounded under alternating trims and appends (sliding window)', () => {
    const index = createSizeIndex()
    index.append(100, () => 10)
    for (let i = 0; i < 10_000; i++) {
      index.trimStart(5)
      index.append(5, () => 10)
    }
    expect(index.count).toBe(100)
    expect(index.total()).toBeCloseTo(1000, 6)
    expect(index.offsetOf(50)).toBeCloseTo(500, 6)
    expect(index.findIndexAtOffset(555)).toBe(55)
  })

  it('handles empty and clamped lookups', () => {
    const index = createSizeIndex()
    expect(index.findIndexAtOffset(10)).toBe(-1)
    expect(index.total()).toBe(0)
    index.setLayout(4, 10, 20)
    expect(index.total()).toBe(30)
    index.append(3, () => 50)
    expect(index.findIndexAtOffset(-5)).toBe(0)
    expect(index.findIndexAtOffset(1e9)).toBe(2)
    expect(index.offsetOf(1)).toBe(64)
    expect(index.total()).toBe(10 + 150 + 8 + 20)
    index.setSize(1, -5)
    expect(index.size(1)).toBe(0)
    expect(index.size(7)).toBe(0)
  })
})
