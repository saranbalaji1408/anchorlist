import { describe, expect, it } from 'vitest'
import { initialPlan } from './ssr'
import { keysOf, mount } from './test/harness'
import { createVirtualizer, type VirtualizerOptions } from './virtualizer'

const opts = (count: number, extra: Partial<VirtualizerOptions> = {}): VirtualizerOptions => ({
  count,
  getKey: (i) => `k${i}`,
  ...extra,
})
const host = { render: () => undefined }

describe('initialPlan', () => {
  it('is plan() without initialRect: empty before attach', () => {
    const v = createVirtualizer(opts(100), host)
    expect(initialPlan(v, opts(100))).toMatchObject({ start: 0, end: -1 })
  })

  it('fills initialRect from the start edge by estimate before attach', () => {
    const o = opts(100, { initialRect: { width: 300, height: 500 } })
    const v = createVirtualizer(o, host)
    // 48 px default: 11 rows reach 528 >= 500.
    expect(initialPlan(v, o)).toMatchObject({ start: 0, end: 10, options: o })
    const sized = { ...o, estimateSize: (i: number) => (i < 2 ? 200 : 50) }
    expect(initialPlan(v, sized)).toMatchObject({ start: 0, end: 3 })
  })

  it('fills from the end edge for align end, and stops at the list edges', () => {
    const o = opts(100, { align: 'end', initialRect: { width: 300, height: 500 }, estimateSize: () => 100 })
    const v = createVirtualizer(o, host)
    expect(initialPlan(v, o)).toMatchObject({ start: 95, end: 99 })
    expect(initialPlan(v, { ...o, count: 3 })).toMatchObject({ start: 0, end: 2 })
    expect(initialPlan(v, { ...o, align: 'start', count: 3 })).toMatchObject({ start: 0, end: 2 })
    expect(initialPlan(v, { ...o, count: 0 })).toMatchObject({ start: 0, end: -1 })
  })

  it('is the same on every call (server and hydration renders match)', () => {
    const o = opts(1000, { initialRect: { width: 300, height: 800 }, estimateSize: (i) => 30 + (i % 7) * 10 })
    expect(initialPlan(createVirtualizer(o, host), o)).toEqual(initialPlan(createVirtualizer(o, host), o))
  })

  it('defers to the engine once attached', async () => {
    const h = mount({ keys: keysOf(1000), size: () => 50, viewport: 500, options: { initialRect: { width: 300, height: 100 } } })
    await h.settle()
    const o = { ...h.v.plan().options, initialRect: { width: 300, height: 100 } }
    expect(initialPlan(h.v, o)).toEqual(h.v.plan(o))
    // The engine's range covers the real viewport plus overscan, not initialRect.
    expect(h.v.plan(o).end).toBeGreaterThan(10)
  })

  it('fills forwards from the initialSnapshot item when it is still at its index', () => {
    const rect = { width: 300, height: 500 }
    const snap = { key: 'k40', index: 40, delta: -10, pinned: false }
    for (const align of ['start', 'end'] as const) {
      const o = opts(100, { align, initialRect: rect, initialSnapshot: snap, estimateSize: () => 100 })
      expect(initialPlan(createVirtualizer(o, host), o)).toMatchObject({ start: 40, end: 44 })
    }
    // Near the end it stops at the last item.
    const late = { ...snap, key: 'k98', index: 98 }
    const o = opts(100, { initialRect: rect, initialSnapshot: late, estimateSize: () => 100 })
    expect(initialPlan(createVirtualizer(o, host), o)).toMatchObject({ start: 98, end: 99 })
  })

  it('falls back to the align edge for a moved, pinned or empty snapshot', () => {
    const rect = { width: 300, height: 500 }
    const base = { align: 'end' as const, initialRect: rect, estimateSize: () => 100 }
    for (const initialSnapshot of [
      { key: 'gone', index: 40, delta: 0, pinned: false },
      { key: 'k40', index: 40, delta: 0, pinned: true },
      { key: null, index: -1, delta: 0, pinned: false },
      { key: 'k400', index: 400, delta: 0, pinned: false },
    ]) {
      const o = opts(100, { ...base, initialSnapshot })
      expect(initialPlan(createVirtualizer(o, host), o)).toMatchObject({ start: 95, end: 99 })
    }
  })
})
