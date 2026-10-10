import { describe, expect, it } from 'vitest'
import { stickyState } from './sticky'
import type { VisibleRange } from './types'

/**
 * A fake scroll container at `origin` px whose mounted rows (`from..to`) are
 * stacked from `first` px (viewport-relative), 50 px each.
 */
function fake(from: number, to: number, first: number, origin = 100, horizontal = false): Element {
  const rect = (start: number): DOMRect => (horizontal ? { left: start } : { top: start }) as unknown as DOMRect
  return {
    getBoundingClientRect: () => rect(origin),
    querySelector(selector: string) {
      const i = Number(/data-index="(-?\d+)"/.exec(selector)![1])
      return i < from || i > to ? null : { getBoundingClientRect: () => rect(origin + first + (i - from) * 50) }
    },
  } as unknown as Element
}
const range = (startIndex: number, endIndex: number): VisibleRange => ({ startIndex, endIndex, startKey: null, endKey: null })
/** Items 0, 10, 20, ... are sticky. */
const tens = (i: number): boolean => i % 10 === 0

describe('stickyState', () => {
  it('is empty for an empty range', () => {
    expect(stickyState(fake(0, 0, 0), range(0, -1), () => true, 40)).toEqual({ index: -1, offset: 0 })
  })

  it('has no stuck item before the first sticky item', () => {
    // Rows 0..20 mounted from 0 px; only item 5 is sticky and it is below the viewport start.
    expect(stickyState(fake(0, 20, 0), range(0, 11), (i) => i === 5, 40)).toEqual({ index: -1, offset: 0 })
  })

  it('sticks the last sticky item at or before the viewport start', () => {
    // Rows 10..30 mounted from -120 px: row 12 spans -20..30.
    expect(stickyState(fake(10, 30, -120), range(12, 23), tens, 40)).toEqual({ index: 10, offset: 0 })
    // The sticky row itself partly scrolled past.
    expect(stickyState(fake(10, 30, -20), range(10, 21), tens, 40)).toEqual({ index: 10, offset: 0 })
  })

  it('sticks an unmounted sticky item above the viewport', () => {
    // Rows 15..30 mounted from -60 px; item 10 is not mounted.
    expect(stickyState(fake(15, 30, -60), range(16, 27), tens, 40)).toEqual({ index: 10, offset: 0 })
  })

  it('lets the next sticky item push the stuck one out', () => {
    // Rows 10..30 from -470 px: row 19 spans -20..30, row 20 starts at 30 (< 40).
    expect(stickyState(fake(10, 30, -470), range(19, 30), tens, 40)).toEqual({ index: 10, offset: -10 })
    // Not yet touching.
    expect(stickyState(fake(10, 30, -440), range(18, 30), tens, 40)).toEqual({ index: 10, offset: 0 })
  })

  it('lets a sticky first visible row that starts below the viewport start push the previous one', () => {
    // A 10 px gap shows above row 20 (starts at 10 px): item 10 sticks, pushed by 30 px.
    expect(stickyState(fake(15, 30, -240), range(20, 31), tens, 40)).toEqual({ index: 10, offset: -30 })
    // With no earlier sticky item nothing sticks (for example the list header is showing).
    expect(stickyState(fake(0, 20, 100), range(0, 9), tens, 40)).toEqual({ index: -1, offset: 0 })
  })

  it('reads the horizontal axis', () => {
    expect(stickyState(fake(10, 30, -470, 7, true), range(19, 30), tens, 40, { start: 'left' })).toEqual({ index: 10, offset: -10 })
  })
})

describe('stickyState walks', () => {
  it('walks only the new indices with the same isSticky function, with the same results', () => {
    // 100k rows, only item 0 sticky; rows around the viewport are mounted from -20 px.
    let calls = 0
    const only0 = (i: number): boolean => (calls++, i === 0)
    const at = (s: number): ReturnType<typeof stickyState> => stickyState(fake(s - 2, s + 20, -120), range(s, s + 10), only0, 40)
    expect(at(90_000)).toEqual({ index: 0, offset: 0 })
    expect(calls).toBeGreaterThan(90_000)
    calls = 0
    for (let s = 90_001; s < 90_100; s++) expect(at(s)).toEqual({ index: 0, offset: 0 })
    expect(calls).toBeLessThan(5_000)
    // Back up the list: the remembered range answers at once.
    calls = 0
    expect(at(50_000)).toEqual({ index: 0, offset: 0 })
    expect(calls).toBeLessThan(50)
    // A different function starts over and agrees.
    expect(stickyState(fake(49_998, 50_020, -120), range(50_000, 50_010), (i) => i === 0, 40)).toEqual({ index: 0, offset: 0 })
  })

  it('finds a sticky item between the remembered walk and a new start', () => {
    const sticky = (i: number): boolean => i === 0 || i === 500
    // Mounted rows start far above the viewport so no row pushes.
    const at = (s: number): number => stickyState(fake(s - 2, s + 20, -120), range(s, s + 10), sticky, 40).index
    expect(at(400)).toBe(0)
    expect(at(600)).toBe(500)
    expect(at(450)).toBe(0)
  })
})
