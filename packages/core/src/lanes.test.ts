import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { grid, masonry, type Lanes } from './lanes'
import type { Scroller } from './scroller'
import type { Key } from './types'
import type { VirtualizerOptions } from './virtualizer'

interface El {
  size: number
  start: number
  style: Record<string, string>
}

/** A scroller that measures fake elements and records spacer writes. */
const fakeScroller = () => {
  const spacers: Array<[number, number]> = []
  const base = {
    measure: (e: El) => ({ start: e.start, size: e.size }),
    setIndex: () => undefined,
    unobserve: () => undefined,
    setSpacers: (b: number, a: number) => void spacers.push([b, a]),
  } as unknown as Scroller<El>
  return { base, spacers }
}

/** Naive masonry: every item goes to the lane that ends first (lowest index on a tie). */
function refMasonry(sizes: number[], n: number, g: number): { start: number; lane: number }[] {
  const ends = new Array<number>(n).fill(0)
  return sizes.map((s) => {
    const lane = ends.indexOf(Math.min(...ends))
    const start = ends[lane]!
    ends[lane] = start + s + g
    return { start, lane }
  })
}

/** Naive grid: rows of n, each as tall as its tallest item. */
function refGrid(sizes: number[], n: number, g: number): { start: number; lane: number }[] {
  const out: { start: number; lane: number }[] = []
  let top = 0
  for (let r = 0; r * n < sizes.length; r++) {
    const row = sizes.slice(r * n, r * n + n)
    row.forEach((_, j) => out.push({ start: top, lane: j }))
    top += Math.max(...row) + g
  }
  return out
}

interface Item {
  key: Key
  est: number
}

type Cmd =
  | { t: 'prepend' | 'append'; sizes: number[] }
  | { t: 'trimStart' | 'trimEnd'; k: number }
  | { t: 'replace'; sizes: number[] }
  | { t: 'measure'; at: number; size: number }
  | { t: 'probe'; at: number[] }

const size = fc.oneof(fc.integer({ min: 0, max: 300 }), fc.double({ min: 0, max: 300, noNaN: true }))
const sizes = fc.array(size, { minLength: 1, maxLength: 30 })
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  fc.record({ t: fc.constantFrom('prepend' as const, 'append' as const), sizes }),
  fc.record({ t: fc.constantFrom('trimStart' as const, 'trimEnd' as const), k: fc.nat(20) }),
  { weight: 1, arbitrary: fc.record({ t: fc.constant('replace' as const), sizes }) },
  { weight: 4, arbitrary: fc.record({ t: fc.constant('measure' as const), at: fc.nat(), size }) },
  { weight: 4, arbitrary: fc.record({ t: fc.constant('probe' as const), at: fc.array(fc.nat(), { maxLength: 8 }) }) },
)

/** Runs `cmds` against `make()` and checks every probed position against `ref`. */
function check(
  make: (n: number, g: number) => Lanes,
  ref: (sizes: number[], n: number, g: number) => { start: number; lane: number }[],
): void {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 16 }), fc.array(cmd, { maxLength: 40 }), (n, g, cmds) => {
      const lanes = make(n, g)
      const { base } = fakeScroller()
      const sc = lanes.scroller(base)
      let items: Item[] = []
      const measured = new Map<Key, number>()
      let next = 0
      const fresh = (s: number[]): Item[] => s.map((est) => ({ key: `k${next++}`, est }))
      const options = (): VirtualizerOptions => {
        const snapshot = items
        return { count: snapshot.length, getKey: (i) => snapshot[i]!.key, estimateSize: (i) => snapshot[i]!.est }
      }
      lanes.sync(options())
      for (const c of cmds) {
        if (c.t === 'prepend') items = [...fresh(c.sizes), ...items]
        else if (c.t === 'append') items = [...items, ...fresh(c.sizes)]
        else if (c.t === 'trimStart') items = items.slice(Math.min(c.k, items.length))
        else if (c.t === 'trimEnd') items = items.slice(0, Math.max(0, items.length - c.k))
        else if (c.t === 'replace') items = fresh(c.sizes)
        if (c.t !== 'measure' && c.t !== 'probe') lanes.sync(options())
        if (!items.length) continue
        if (c.t === 'measure') {
          // Mount, measure and unmount one item through the scroller.
          const i = c.at % items.length
          const el: El = { size: c.size, start: 0, style: {} }
          sc.setIndex(el, i, items.length)
          sc.measure(el)
          sc.unobserve(el)
          measured.set(items[i]!.key, c.size)
        }
        if (c.t === 'probe') {
          const expected = ref(
            items.map((m) => measured.get(m.key) ?? m.est),
            n,
            g,
          )
          for (const a of c.at) {
            const i = a % items.length
            const p = lanes.position(i)
            expect(p.lane).toBe(expected[i]!.lane)
            expect(p.start).toBeCloseTo(expected[i]!.start, 6)
          }
        }
      }
    }),
    { numRuns: 300 },
  )
}

describe('masonry', () => {
  it('matches a naive layout through edits, measurements and out-of-order probes', () => {
    check((n, g) => masonry({ lanes: n, gap: g }), refMasonry)
  })

  it('reports each item’s share of the main axis to the engine and sizes the list by the longest lane', () => {
    const lanes = masonry({ lanes: 2, gap: 10 })
    const keys = ['a', 'b', 'c', 'd']
    const est = [100, 50, 30, 40]
    const o: VirtualizerOptions = { count: 4, getKey: (i) => keys[i]!, estimateSize: (i) => est[i]!, gap: 4, paddingStart: 9 }
    const converted = lanes.options(o)
    expect(converted).toMatchObject({ count: 4, gap: 0, paddingStart: 0, paddingEnd: 0 })
    expect(converted.estimateSize!(0)).toBe(55)
    lanes.sync(o)
    const { base, spacers } = fakeScroller()
    const sc = lanes.scroller(base)
    // Lanes: a (0..110), b (0..60), c (60..100), d (100..150) in lane 1.
    const els = est.map((s, i): El => ({ size: s, start: i * 7, style: {} }))
    els.forEach((e, i) => sc.setIndex(e, i, 4))
    expect(els[3]!.style).toEqual({
      position: 'absolute',
      top: '100px',
      insetInlineStart: 'calc((100% - 10px) / 2 * 1 + 10px)',
      width: 'calc((100% - 10px) / 2)',
    })
    // The engine sees (size + gap) / lanes and the element's real start.
    expect(sc.measure(els[2]!)).toEqual({ start: 14, size: 20 })
    // c grows by 50: d moves to lane 0 after a.
    els[2]!.size = 80
    sc.measure(els[2]!)
    sc.setSpacers(123, 7)
    expect(els[3]!.style.top).toBe('110px')
    expect(els[3]!.style.insetInlineStart).toBe('calc((100% - 10px) / 2 * 0 + 0px)')
    // The list holds the longest lane (a + d = 150) plus the engine's size after the last mounted item.
    expect(spacers.at(-1)).toEqual([0, 157])
    expect(lanes.range({ start: 1, end: 2 }, 4)).toEqual({ start: 1, end: 2 })
  })

  it('lays out lazily: only up to the item that is needed', () => {
    const lanes = masonry({ lanes: 3 })
    let reads = 0
    lanes.sync({
      count: 100_000,
      getKey: (i) => i,
      estimateSize: () => {
        reads++
        return 10
      },
    })
    expect(lanes.position(30)).toEqual({ start: 100, lane: 0 })
    expect(reads).toBe(31)
    lanes.position(10)
    expect(reads).toBe(31)
  })
})

describe('grid', () => {
  it('matches a naive layout through edits, measurements and out-of-order probes', () => {
    check((n, g) => grid({ lanes: n, gap: g }), refGrid)
  })

  it('puts each row’s size on its first item, so engine offsets are row offsets', () => {
    const lanes = grid({ lanes: 3, gap: 5, horizontal: true })
    const sizes = [10, 40, 20, 30, 5]
    const o: VirtualizerOptions = { count: 5, getKey: (i) => i, estimateSize: (i) => sizes[i]! }
    const est = lanes.options(o).estimateSize!
    expect([0, 1, 2, 3, 4].map(est)).toEqual([45, 0, 0, 35, 0])
    lanes.sync(o)
    const { base, spacers } = fakeScroller()
    const sc = lanes.scroller(base)
    const els = sizes.map((s): El => ({ size: s, start: 0, style: {} }))
    els.forEach((e, i) => sc.setIndex(e, i, 5))
    expect(els[4]!.style).toEqual({
      position: 'absolute',
      insetInlineStart: '45px',
      top: 'calc((100% - 10px) / 3 * 1 + 5px)',
      height: 'calc((100% - 10px) / 3)',
    })
    // The first item reports its row's live size: the tallest mounted item, plus the gap.
    els[2]!.size = 70
    expect(sc.measure(els[0]!).size).toBe(75)
    expect(sc.measure(els[1]!).size).toBe(0)
    sc.measure(els[2]!)
    sc.setSpacers(0, 0)
    expect(els[3]!.style.insetInlineStart).toBe('75px')
    expect(spacers.at(-1)).toEqual([0, 105])
    // Ranges widen to whole rows.
    expect(lanes.range({ start: 4, end: 4 }, 5)).toEqual({ start: 3, end: 4 })
    expect(lanes.range({ start: 1, end: 3 }, 5)).toEqual({ start: 0, end: 4 })
    expect(lanes.range({ start: 0, end: -1 }, 0)).toEqual({ start: 0, end: -1 })
  })

  it('leaves unmounted and unknown elements alone and forgets removed sizes', () => {
    const lanes = grid({ lanes: 2 })
    const { base, spacers } = fakeScroller()
    const sc = lanes.scroller(base)
    const stray: El = { size: 30, start: 4, style: {} }
    expect(sc.measure(stray)).toEqual({ start: 4, size: 30 })
    sc.setSpacers(10, 20)
    expect(spacers.at(-1)).toEqual([10, 20])
    // 300 items measured, then replaced: the old sizes are dropped.
    let keys = Array.from({ length: 300 }, (_, i) => `a${i}`)
    lanes.sync({ count: 300, getKey: (i) => keys[i]! })
    keys.forEach((_, i) => {
      const el: El = { size: 10, start: 0, style: {} }
      sc.setIndex(el, i, 300)
      sc.measure(el)
      sc.unobserve(el)
    })
    keys = Array.from({ length: 10 }, (_, i) => `b${i}`)
    lanes.sync({ count: 10, getKey: (i) => keys[i]! })
    // Unmeasured items use the default estimate (48).
    expect(lanes.position(9)).toEqual({ start: 4 * 48, lane: 1 })
  })
})
