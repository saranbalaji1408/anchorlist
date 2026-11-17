import { makeItems, rng } from '../src/data'
import { expect, test, TOLERANCE } from '../src/harness'

const VIEWPORT = 600

test.describe('scrollToKey', () => {
  for (const align of ['start', 'center', 'end'] as const) {
    test(`reaches an unmounted row 2000 rows away (align ${align})`, async ({ d }) => {
      const items = makeItems(3000, 'm', rng(15))
      await d.mount({ items })
      expect(await d.isMounted('m999')).toBe(false)
      expect(await d.scrollToKey('nope')).toBe(false)
      expect(await d.scrollToKey('m999', { align })).toBe(true)
      await d.frames(3)
      const row = await d.rowRect('m999')
      const error =
        align === 'start' ? row.top : align === 'end' ? row.bottom - VIEWPORT : (row.top + row.bottom) / 2 - VIEWPORT / 2
      expect(Math.abs(error)).toBeLessThanOrEqual(1)
      expect((await d.getItemRect('m999'))?.measured).toBe(true)
      // Stays there while neighbours are measured.
      await d.frames(3)
      expect(Math.abs((await d.rowRect('m999')).top - row.top)).toBeLessThanOrEqual(TOLERANCE)
    })
  }

  test('applies the offset option', async ({ d }) => {
    await d.mount({ items: makeItems(500, 'm', rng(41)), align: 'start' })
    expect(await d.scrollToKey('m200', { offset: -30 })).toBe(true)
    await d.frames(3)
    expect(Math.abs((await d.rowRect('m200')).top - 30)).toBeLessThanOrEqual(1)
  })

  test('scrollToEdge returns to the end and pins', async ({ d }) => {
    const items = makeItems(500, 'm', rng(16))
    await d.mount({ items })
    await d.scrollToIndex(10)
    await d.frames(2)
    expect(await d.isAtEdge()).toBe(false)
    await d.scrollToEdge()
    await d.frames(2)
    expect(await d.isAtEdge()).toBe(true)
    expect(await d.isMounted('m499')).toBe(true)
    expect((await d.getSnapshot()).pinned).toBe(true)
  })

  test('scrollToEdge("start") reaches the first item of an end-aligned list', async ({ d }) => {
    await d.mount({ items: makeItems(500, 'm', rng(42)) })
    await d.scrollToEdge('start')
    await d.frames(3)
    expect(await d.isAtEdge('start')).toBe(true)
    expect((await d.rowRect('m0')).top).toBeCloseTo(0, 0)
  })
})
