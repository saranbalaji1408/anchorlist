import { makeItems, rng } from '../src/data'
import { expect, test, TOLERANCE } from '../src/harness'

const VIEWPORT = 600

test.describe('core behaviour', () => {
  test('starts over at the bottom after a clear while scrolled up (align end)', async ({ d }) => {
    await d.mount({ items: makeItems(100, 'm', rng(21)), align: 'end' })
    await d.scrollBy(-3000)
    expect(await d.isAtEdge()).toBe(false)
    await d.update({ items: [] })
    await d.frames(2)
    const fresh = makeItems(100, 'r', rng(22))
    await d.update({ items: fresh })
    await d.frames(3)
    expect(await d.isAtEdge()).toBe(true)
    expect(Math.abs((await d.rowRect(fresh[99]!.id)).bottom - VIEWPORT)).toBeLessThanOrEqual(TOLERANCE)
  })

  test('starts over at the bottom after a full replacement while scrolled up (align end)', async ({ d }) => {
    await d.mount({ items: makeItems(100, 'm', rng(23)), align: 'end' })
    await d.scrollBy(-3000)
    await d.update({ items: makeItems(100, 'r', rng(24)) })
    await d.frames(3)
    expect(await d.isAtEdge()).toBe(true)
  })

  for (const align of ['end', 'start'] as const) {
    test(`keeps rows after the gap still when the anchor and its neighbours are removed (align ${align})`, async ({ d }) => {
      let items = makeItems(120, 'm', rng(25))
      await d.mount({ items, align, overscan: 800 })
      await d.scrollBy(align === 'end' ? -2500 : 2500)
      const anchor = await d.rowAt(1)
      const i = items.findIndex((m) => m.id === anchor)
      const held = items[i + 6]!.id
      const edge = async (): Promise<number> => {
        const r = await d.rowRect(held)
        return align === 'end' ? r.bottom : r.top
      }
      const before = await edge()
      const gone = new Set(items.slice(i - 5, i + 6).map((m) => m.id))
      items = items.filter((m) => !gone.has(m.id))
      await d.update({ items })
      await d.frames(3)
      expect(Math.abs((await edge()) - before)).toBeLessThanOrEqual(TOLERANCE)
    })
  }
})
