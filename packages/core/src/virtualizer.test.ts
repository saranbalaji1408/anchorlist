import { describe, expect, it, vi } from 'vitest'
import { keysOf, mount } from './test/harness'
import type { Key } from './types'

const sized = (key: Key): number => 40 + (Number(String(key).replace(/\D/g, '')) % 7) * 10

describe('align end (chat)', () => {
  it('mounts pinned to the end, with the last item at the bottom', async () => {
    const h = mount({ keys: keysOf(200), size: sized, viewport: 500, options: { align: 'end' } })
    await h.settle()
    expect(h.v.isAtEdge()).toBe(true)
    expect(h.visualEnd('k199')).toBeCloseTo(500, 5)
    expect(h.v.getSnapshot().pinned).toBe(true)
    expect(h.mounted.size).toBeLessThan(60)
  })

  it('keeps the anchor fixed on prepend', async () => {
    const h = mount({ keys: keysOf(100, 'k', 100), size: sized, viewport: 500, options: { align: 'end' } })
    await h.settle()
    h.sim.userScroll(h.sim.offset() - 1200)
    await h.settle()
    const anchor = h.v.getSnapshot().key!
    const before = h.visualEnd(anchor)!
    const renders = h.renders
    h.setKeys([...keysOf(50, 'k', 50), ...h.keys])
    await h.settle()
    expect(h.visualEnd(anchor)).toBeCloseTo(before, 5)
    expect(h.v.isAtEdge()).toBe(false)
    expect(h.renders - renders).toBeLessThanOrEqual(3)
  })

  it('follows appends while pinned, including trim+append', async () => {
    const h = mount({ keys: keysOf(50), size: sized, viewport: 500, options: { align: 'end' } })
    await h.settle()
    h.setKeys([...h.keys, 'n1', 'n2'])
    await h.settle()
    expect(h.visualEnd('n2')).toBeCloseTo(500, 5)
    h.setKeys([...h.keys.slice(5), 'n3'])
    await h.settle()
    expect(h.visualEnd('n3')).toBeCloseTo(500, 5)
    expect(h.v.isAtEdge()).toBe(true)
  })

  it('does not follow appends when scrolled away', async () => {
    const h = mount({ keys: keysOf(80), size: sized, viewport: 500, options: { align: 'end' } })
    await h.settle()
    h.sim.userScroll(h.sim.offset() - 600)
    await h.settle()
    const anchor = h.v.getSnapshot().key!
    const before = h.visualEnd(anchor)!
    h.setKeys([...h.keys, 'n1', 'n2', 'n3'])
    await h.settle()
    expect(h.visualEnd(anchor)).toBeCloseTo(before, 5)
  })

  it('forces follow when follow() returns true', async () => {
    const follow = vi.fn(() => true)
    const h = mount({ keys: keysOf(80), size: sized, viewport: 500, options: { align: 'end', follow } })
    await h.settle()
    h.sim.userScroll(100)
    await h.settle()
    h.setKeys([...h.keys, 'mine'])
    await h.settle()
    expect(follow).toHaveBeenCalledWith({ atEdge: false, added: 1, count: 81 })
    expect(h.visualEnd('mine')).toBeCloseTo(500, 5)
  })

  it('keeps the anchor when it grows (end edge fixed) and when items above it grow', async () => {
    const h = mount({ keys: keysOf(100), size: sized, viewport: 500, options: { align: 'end' } })
    await h.settle()
    h.sim.userScroll(h.sim.offset() - 800)
    await h.settle()
    const anchor = h.v.getSnapshot().key!
    const i = h.v.indexOf(anchor)
    const before = h.visualEnd(anchor)!
    h.resize(anchor, 200)
    h.resize(h.keys[i - 1]!, 300)
    await h.settle()
    expect(h.visualEnd(anchor)).toBeCloseTo(before, 5)
  })

  it('keeps the bottom fixed when the viewport shrinks', async () => {
    const h = mount({ keys: keysOf(100), size: sized, viewport: 500, options: { align: 'end' } })
    await h.settle()
    h.sim.userScroll(h.sim.offset() - 300)
    await h.settle()
    const anchor = h.v.getSnapshot().key!
    const fromBottom = 500 - h.visualEnd(anchor)!
    h.sim.resizeViewport(300)
    await h.settle()
    expect(300 - h.visualEnd(anchor)!).toBeCloseTo(fromBottom, 5)
  })
})

describe('align start (feed)', () => {
  it('mounts at the start and stays there when items are prepended', async () => {
    const h = mount({ keys: keysOf(100, 'k', 100), size: sized, viewport: 500 })
    await h.settle()
    expect(h.sim.offset()).toBe(0)
    expect(h.visualStart('k100')).toBe(0)
    h.setKeys([...keysOf(5, 'k', 95), ...h.keys])
    await h.settle()
    expect(h.visualStart('k95')).toBe(0)
  })

  it('keeps the anchor on prepend when scrolled away', async () => {
    const h = mount({ keys: keysOf(100, 'k', 100), size: sized, viewport: 500 })
    await h.settle()
    h.sim.userScroll(900)
    await h.settle()
    const anchor = h.v.getSnapshot().key!
    const before = h.visualStart(anchor)!
    h.setKeys([...keysOf(30, 'k', 70), ...h.keys])
    await h.settle()
    expect(h.visualStart(anchor)).toBeCloseTo(before, 5)
  })
})

describe('anchor removal', () => {
  it('falls back to a neighbour and never jumps to an edge', async () => {
    const h = mount({ keys: keysOf(100), size: sized, viewport: 500, options: { align: 'end' } })
    await h.settle()
    h.sim.userScroll(1500)
    await h.settle()
    const anchor = h.v.getSnapshot().key!
    const i = h.v.indexOf(anchor)
    const next = h.keys[i + 1]!
    const before = h.visualEnd(next)!
    h.setKeys(h.keys.filter((k) => k !== anchor))
    await h.settle()
    expect(h.visualEnd(next)).toBeCloseTo(before, 5)
    expect(h.v.isAtEdge()).toBe(false)
  })
})

describe('scrollToKey', () => {
  it('lands on an unmounted item and stays locked while it grows', async () => {
    const h = mount({ keys: keysOf(500), size: sized, viewport: 500, options: { align: 'end' } })
    await h.settle()
    expect(h.v.scrollToKey('missing')).toBe(false)
    expect(h.v.scrollToKey('k100', { align: 'start' })).toBe(true)
    await h.settle(2)
    expect(h.visualStart('k100')).toBeCloseTo(0, 5)
    h.resize('k99', 500)
    h.resize('k100', 300)
    await h.settle(1)
    expect(h.visualStart('k100')).toBeCloseTo(0, 5)
    await h.settle(10)
    expect(h.visualStart('k100')).toBeCloseTo(0, 5)
  })

  it('supports center and end alignment and scrollToIndex', async () => {
    const h = mount({ keys: keysOf(300), size: () => 50, viewport: 500 })
    await h.settle()
    h.v.scrollToKey('k150', { align: 'center' })
    await h.settle()
    expect(h.visualStart('k150')).toBeCloseTo(225, 5)
    expect(h.v.scrollToIndex(200, { align: 'end' })).toBe(true)
    await h.settle()
    expect(h.visualEnd('k200')).toBeCloseTo(500, 5)
    expect(h.v.scrollToIndex(999)).toBe(false)
  })

  it('is cancelled by user input', async () => {
    const h = mount({ keys: keysOf(300), size: () => 50, viewport: 500 })
    await h.settle()
    h.v.scrollToKey('k150')
    await h.settle(1)
    h.sim.userScroll(h.sim.offset() + 120)
    await h.settle()
    expect(h.visualStart('k150')).toBeCloseTo(-120, 5)
  })
})

describe('edges and callbacks', () => {
  it('scrollToEdge, isAtEdge and onAtEdgeChange', async () => {
    const onAtEdgeChange = vi.fn()
    const h = mount({ keys: keysOf(200), size: sized, viewport: 500, options: { align: 'end', onAtEdgeChange } })
    await h.settle()
    expect(onAtEdgeChange).toHaveBeenLastCalledWith(true)
    h.v.scrollToEdge('start')
    await h.settle()
    expect(h.sim.offset()).toBe(0)
    expect(h.v.isAtEdge('start')).toBe(true)
    expect(onAtEdgeChange).toHaveBeenLastCalledWith(false)
    h.v.scrollToEdge()
    await h.settle()
    expect(h.v.isAtEdge()).toBe(true)
    expect(h.v.getSnapshot().pinned).toBe(true)
  })

  it('fires onStartReached once per entry and again when the first item changes', async () => {
    const onStartReached = vi.fn()
    const h = mount({
      keys: keysOf(100, 'k', 100),
      size: () => 50,
      viewport: 500,
      options: { align: 'end', hasMoreStart: true, onStartReached, startThreshold: 300 },
    })
    await h.settle()
    expect(onStartReached).not.toHaveBeenCalled()
    h.sim.userScroll(100)
    await h.settle()
    expect(onStartReached).toHaveBeenCalledTimes(1)
    h.sim.userScroll(50)
    await h.settle()
    expect(onStartReached).toHaveBeenCalledTimes(1)
    h.setKeys([...keysOf(2, 'k', 98), ...h.keys])
    await h.settle()
    expect(onStartReached).toHaveBeenCalledTimes(2)
  })

  it('suppresses edge triggers and defers corrections while overscrolled', async () => {
    const onStartReached = vi.fn()
    const h = mount({
      keys: keysOf(100, 'k', 100),
      size: () => 50,
      viewport: 500,
      options: { hasMoreStart: true, onStartReached, startThreshold: 300 },
    })
    await h.settle()
    h.sim.userScroll(1000)
    await h.settle()
    onStartReached.mockClear()
    h.sim.setOverscroll(-40)
    h.sim.userScroll(0)
    h.sim.setOverscroll(-40)
    await h.settle(1)
    expect(onStartReached).not.toHaveBeenCalled()
    const anchor = h.v.getSnapshot().key!
    const before = h.visualStart(anchor)!
    const offset = h.sim.offset()
    h.setKeys([...keysOf(3, 'k', 97), ...h.keys])
    expect(h.sim.offset()).toBe(offset)
    expect(h.sim.translation).not.toBe(0)
    expect(h.visualStart(anchor)).toBeCloseTo(before, 5)
    h.sim.setOverscroll(0)
    await h.settle()
    expect(h.sim.translation).toBe(0)
    // The bounce itself (40 px) is gone; the content did not move.
    expect(h.visualStart(anchor)).toBeCloseTo(before - 40, 5)
    expect(onStartReached).toHaveBeenCalled()
  })

  it('reports the visible range', async () => {
    const onRangeChange = vi.fn()
    const h = mount({ keys: keysOf(100), size: () => 50, viewport: 500, options: { onRangeChange } })
    await h.settle()
    expect(h.v.getVisibleRange()).toEqual({ startIndex: 0, endIndex: 9, startKey: 'k0', endKey: 'k9' })
    const listener = vi.fn()
    const off = h.v.subscribe(listener)
    h.sim.userScroll(125)
    await h.settle()
    expect(h.v.getVisibleRange()).toEqual({ startIndex: 2, endIndex: 12, startKey: 'k2', endKey: 'k12' })
    expect(onRangeChange).toHaveBeenLastCalledWith(h.v.getVisibleRange())
    expect(listener).toHaveBeenCalled()
    off()
  })
})

describe('touch WebKit deferral', () => {
  it('holds corrections in a transform during touch and commits them when idle', async () => {
    const h = mount({ keys: keysOf(100, 'k', 100), size: () => 50, viewport: 500, touchWebKit: true, options: { align: 'end' } })
    await h.settle(20)
    h.sim.advance(500)
    h.sim.touch(true)
    h.sim.userScroll(h.sim.offset() - 1000)
    await h.settle(1)
    const anchor = h.v.getSnapshot().key!
    const before = h.visualEnd(anchor)!
    const offset = h.sim.offset()
    const shift = h.sim.translation
    h.setKeys([...keysOf(10, 'k', 90), ...h.keys])
    // Ten prepended items at the 48 px default estimate, held in the transform.
    expect(h.sim.offset()).toBe(offset)
    expect(h.sim.translation - shift).toBe(-480)
    expect(h.visualEnd(anchor)).toBeCloseTo(before, 5)
    const pending = -h.sim.translation
    h.sim.touch(false)
    h.sim.advance(200)
    expect(h.sim.translation).toBe(0)
    expect(h.sim.offset()).toBe(offset + pending)
    expect(h.visualEnd(anchor)).toBeCloseTo(before, 5)
  })
})

describe('sizes', () => {
  it('remeasures mounted rows in the same frame on a cross-axis resize', async () => {
    const h = mount({ keys: keysOf(50), size: () => 50, viewport: 500 })
    await h.settle()
    h.sim.userScroll(400)
    await h.settle()
    expect(h.v.getItemRect('k10')).toEqual({ start: 500, size: 50, measured: true })
    const anchor = h.v.getSnapshot().key!
    const before = h.visualStart(anchor)!
    for (const key of h.keys) h.resize(key, 80)
    h.sim.resizeViewport(500, 300)
    h.sim.tick()
    expect(h.visualStart(anchor)).toBeCloseTo(before, 5)
    expect(h.v.getItemRect('k10')!.size).toBe(80)
    expect(h.v.getItemRect('k49')!.measured).toBe(false)
  })

  it('applies gap and padding', async () => {
    const h = mount({ keys: keysOf(10), size: () => 50, viewport: 300, gap: 10, options: { paddingStart: 20, paddingEnd: 30 } })
    await h.settle()
    expect(h.v.getTotalSize()).toBe(20 + 10 * 50 + 9 * 10 + 30)
    expect(h.visualStart('k1')).toBe(80)
    expect(h.v.getItemRect('k2')!.start).toBe(140)
  })

  it('refreshes estimates at idle when the measured average drifts', async () => {
    const h = mount({ keys: keysOf(1000), size: () => 100, viewport: 500 })
    await h.settle()
    expect(h.v.getTotalSize()).toBeLessThan(100 * 1000)
    h.sim.advance(400)
    await h.settle()
    expect(h.v.getTotalSize()).toBeCloseTo(100 * 1000, 5)
  })

  it('rebuilds on a middle change and validates keys at idle', async () => {
    const h = mount({ keys: keysOf(100), size: () => 50, viewport: 500 })
    await h.settle()
    h.setKeys([...h.keys.slice(0, 50), 'x', ...h.keys.slice(50)])
    await h.settle()
    expect(h.v.indexOf('x')).toBe(50)
    expect(h.v.indexOf('k50')).toBe(51)
    // Same edges and count, middle swapped: found lazily at idle.
    const swapped = [...h.keys]
    ;[swapped[60], swapped[61]] = [swapped[61]!, swapped[60]!]
    h.setKeys(swapped)
    h.sim.advance(400)
    expect(h.v.indexOf(swapped[60]!)).toBe(60)
  })

  it('writes data-index and aria attributes', async () => {
    const h = mount({ keys: keysOf(20), size: () => 50, viewport: 300 })
    const setIndex = vi.spyOn(h.sim, 'setIndex')
    h.setKeys(['p', ...h.keys])
    expect(setIndex).toHaveBeenCalledWith(h.mounted.get('k0'), 1, 21)
    h.setOptions({ hasMoreEnd: true })
    expect(setIndex).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), -1)
  })
})

describe('snapshot', () => {
  it('restores an item position', async () => {
    const a = mount({ keys: keysOf(200), size: () => 50, viewport: 500, options: { align: 'end' } })
    await a.settle()
    a.sim.userScroll(2025)
    await a.settle()
    const snapshot = a.v.getSnapshot()
    expect(snapshot.pinned).toBe(false)
    const b = mount({ keys: keysOf(200), size: () => 50, viewport: 500, options: { align: 'end', initialSnapshot: snapshot } })
    await b.settle()
    expect(b.visualEnd(snapshot.key!)).toBeCloseTo(snapshot.delta, 5)
    expect(b.v.isAtEdge()).toBe(false)
  })
})
