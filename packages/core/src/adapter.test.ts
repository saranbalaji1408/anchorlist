import { describe, expect, it } from 'vitest'
import { initialPlan, keptRow } from './adapter'
import { keysOf, mount } from './test/harness'
import type { Key } from './types'
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
})

describe('keptRow', () => {
  const at = (list: Key[]) => ({ ...opts(list.length), getKey: (i: number) => list[i]! })

  it('is null without a key, inside the range, or for unknown keys', async () => {
    const h = mount({ keys: keysOf(500), size: () => 50, viewport: 500 })
    await h.settle()
    const plan = h.v.plan()
    expect(keptRow(h.v, plan, null)).toBeNull()
    expect(keptRow(h.v, plan, undefined)).toBeNull()
    expect(keptRow(h.v, plan, h.keys[plan.start]!)).toBeNull()
    expect(keptRow(h.v, plan, 'nope')).toBeNull()
  })

  it('returns the index and list-space start of a row outside the range', async () => {
    const h = mount({ keys: keysOf(500), size: () => 50, viewport: 500, gap: 4, options: { paddingStart: 10, estimateSize: () => 50 } })
    await h.settle()
    h.sim.userScroll(200 * 54)
    await h.settle()
    const plan = h.v.plan()
    expect(plan.start).toBeGreaterThan(3)
    expect(keptRow(h.v, plan, h.keys[3]!)).toEqual({ index: 3, start: 10 + 3 * 54 })
    expect(keptRow(h.v, plan, h.keys[499]!)).toEqual({ index: 499, start: 10 + 499 * 54 })
  })

  it('finds the key in a changed list before it is committed', async () => {
    const h = mount({ keys: keysOf(500), size: () => 50, viewport: 500 })
    await h.settle()
    h.sim.userScroll(10_000)
    await h.settle()
    const key = h.keys[3]!
    const next = ['p0', 'p1', ...h.keys]
    const plan = h.v.plan(at(next))
    expect(keptRow(h.v, plan, key)).toMatchObject({ index: 5 })
    expect(keptRow(h.v, h.v.plan(at(next.filter((k) => k !== key))), key)).toBeNull()
  })
})
