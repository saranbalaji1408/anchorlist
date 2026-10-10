import { describe, expect, it } from 'vitest'
import { snapshotEstimate, takeSnapshot } from './snapshot'
import { keysOf, mount } from './test/harness'
import type { Key } from './types'

const size = (k: Key): number => 30 + (Number(String(k).slice(1)) % 7) * 20

describe('takeSnapshot', () => {
  it('adds the measured sizes around the anchor to getSnapshot()', async () => {
    const h = mount({ keys: keysOf(2000), size, viewport: 500 })
    await h.settle()
    h.v.scrollToKey(h.keys[1000]!)
    await h.settle()
    const getKey = (i: number): Key => h.keys[i]!
    const snap = takeSnapshot(h.v, getKey, h.keys.length)
    expect(snap).toMatchObject(h.v.getSnapshot())
    expect(snap.sizes!.length).toBeGreaterThan(5)
    for (const [k, s] of snap.sizes!) expect(s).toBe(size(k))
    // Only measured items, within `limit` indices of the anchor.
    const small = takeSnapshot(h.v, getKey, h.keys.length, 10)
    expect(small.sizes!.every(([k]) => Math.abs(h.v.indexOf(k) - snap.index) <= 5)).toBe(true)
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap)
  })

  it('is empty for an empty list', () => {
    const h = mount({ keys: [], size, viewport: 500 })
    expect(takeSnapshot(h.v, () => 'x', 0)).toMatchObject({ key: null, sizes: [] })
  })
})

describe('snapshotEstimate', () => {
  it('answers stored sizes, then estimateSize, then the stored average', () => {
    const snap = { key: 'k1', index: 1, delta: 0, pinned: false, sizes: [['k1', 100], ['k2', 50]] as const }
    const getKey = (i: number): Key => `k${i}`
    expect(snapshotEstimate(snap, getKey)!(1)).toBe(100)
    expect(snapshotEstimate(snap, getKey)!(5)).toBe(75)
    expect(snapshotEstimate(snap, getKey, () => 20)!(5)).toBe(20)
    const plain = (): number => 33
    expect(snapshotEstimate({ ...snap, sizes: [] }, getKey, plain)).toBe(plain)
    expect(snapshotEstimate(undefined, getKey)).toBeUndefined()
  })

  it('restores rows above the anchor at their measured sizes from the first frame', async () => {
    const a = mount({ keys: keysOf(2000), size, viewport: 500 })
    await a.settle()
    a.v.scrollToKey(a.keys[1000]!)
    await a.settle()
    a.sim.userScroll(a.sim.offset() - 1000)
    await a.settle()
    const keys = a.keys
    const getKey = (i: number): Key => keys[i]!
    const snap = takeSnapshot(a.v, getKey, keys.length, 400)

    const b = mount({
      keys,
      size,
      viewport: 500,
      options: { initialSnapshot: snap, estimateSize: snapshotEstimate(snap, getKey) },
    })
    await b.settle()
    expect(Math.abs(b.visualStart(snap.key!)! - snap.delta)).toBeLessThanOrEqual(0.5)
    // Stored rows that are not mounted use their measured size, not the 48 px default.
    const far = snap.sizes!.map(([k]) => k).find((k) => !b.mounted.has(k))!
    expect(far).toBeDefined()
    expect(b.v.getItemRect(far)).toMatchObject({ size: size(far), measured: false })
  })
})
