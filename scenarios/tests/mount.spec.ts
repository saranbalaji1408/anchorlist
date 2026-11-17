import { makeItems, rng } from '../src/data'
import { expect, test } from '../src/harness'

test.describe('first mount', () => {
  test('paints the first frame at the end and never mounts rows with the scroller', async ({ d }) => {
    const items = makeItems(80, 'm', rng(1))
    await d.startSampler(['rows', 'distEnd'])
    await d.mount({ items, align: 'end' })
    await d.frames(3)
    const samples = await d.stopSampler()
    expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    const first = samples[0]!
    expect(first[0]).toBeGreaterThan(0)
    expect(first[1]).toBeLessThanOrEqual(1)
    expect(await d.rendersWithoutScroller()).toEqual([])
    // The newest row is fully visible at the bottom.
    expect(Math.abs((await d.rowRect('m79')).bottom - 600)).toBeLessThanOrEqual(1)
  })

  test('a top-anchored list paints its first frame at the start', async ({ d }) => {
    await d.startSampler(['rows', 'scrollTop'])
    await d.mount({ items: makeItems(80, 'm', rng(2)), align: 'start' })
    await d.frames(2)
    const first = (await d.stopSampler())[0]!
    expect(first[0]).toBeGreaterThan(0)
    expect(first[1]).toBe(0)
    expect((await d.rowRect('m0')).top).toBe(0)
  })

  test('restores a snapshot on remount', async ({ d }) => {
    const items = makeItems(300, 'm', rng(3))
    await d.mount({ items, align: 'end' })
    await d.scrollToKey('m100', { align: 'center' })
    await d.frames(3)
    await d.scrollBy(-37)
    const top = (await d.rowRect('m100')).top
    const snapshot = await d.getSnapshot()
    expect(snapshot.pinned).toBe(false)
    await d.unmount()
    await d.mount({ items, align: 'end', initialSnapshot: snapshot })
    await d.frames(2)
    expect(Math.abs((await d.rowRect('m100')).top - top)).toBeLessThanOrEqual(1)
  })

  test('mounts in StrictMode at the end and keeps prepends still', async ({ d }) => {
    const random = rng(22)
    const items = makeItems(60, 'm', random)
    await d.mount({ items, align: 'end', strict: true, hasMoreStart: true })
    expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    expect(await d.rendersWithoutScroller()).toEqual([])
    await d.scrollBy(-2000)
    const anchor = await d.rowAt(300)
    const before = (await d.rowRect(anchor)).top
    await d.update({ items: [...makeItems(20, 'p', random), ...items] })
    expect((await d.rowRect(anchor)).top).toBeCloseTo(before, 1)
    await d.frames(4)
    expect((await d.rowRect(anchor)).top).toBeCloseTo(before, 1)
    // The double-invoked effects left exactly one working instance: scrolling still re-anchors.
    expect(await d.scrollToKey('p5')).toBe(true)
    await d.frames(3)
    expect(Math.abs((await d.rowRect('p5')).top)).toBeLessThanOrEqual(1)
  })
})

test.describe('cleanup', () => {
  test('disconnects the ResizeObserver on unmount', async ({ d }) => {
    await d.mount({ items: makeItems(20, 'm', rng(21)) })
    await d.countDisconnects()
    await d.unmount()
    expect(await d.disconnects()).toBe(1)
  })
})
