import { describe, expect, it } from 'vitest'
import { keptRow } from './adapter'
import { keysOf, mount } from './test/harness'
import type { Key } from './types'
import type { VirtualizerOptions } from './virtualizer'

const opts = (count: number, extra: Partial<VirtualizerOptions> = {}): VirtualizerOptions => ({
  count,
  getKey: (i) => `k${i}`,
  ...extra,
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

  it('returns the index and content-space start of a row outside the range', async () => {
    const h = mount({ keys: keysOf(500), size: () => 50, viewport: 500, gap: 4, header: 100, options: { paddingStart: 10, estimateSize: () => 50 } })
    await h.settle()
    h.sim.userScroll(200 * 54)
    await h.settle()
    const plan = h.v.plan()
    expect(plan.start).toBeGreaterThan(3)
    // Content space: header, padding, then items with gaps (like getItemRect).
    expect(keptRow(h.v, plan, h.keys[3]!)).toEqual({ index: 3, start: 100 + 10 + 3 * 54, offset: 10 + 3 * 54 })
    expect(keptRow(h.v, plan, h.keys[499]!)).toEqual({ index: 499, start: 100 + 10 + 499 * 54, offset: 10 + 499 * 54 })
    expect(keptRow(h.v, plan, h.keys[3]!)!.start).toBe(h.v.getItemRect(h.keys[3]!)!.start)
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
