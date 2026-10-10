import type { Page } from '@playwright/test'
import { axis, installAxis, stillOnAxis } from '../src/axis'
import { makeItems, rng } from '../src/data'
import { expect, test, TOLERANCE } from '../src/harness'

// The page scrolls (the list container has no height). Optionally a fixed bar
// covers the top MARGIN px of the window and is passed as `scrollMargin`.
const MARGIN = 56

/** First mounted row whose start is at or below `at` px from the viewport start. */
async function rowFrom(page: Page, at: number): Promise<string> {
  const a = axis(page)
  for (const key of await a.keys()) if ((await a.start(key)) >= at) return key
  throw new Error(`no row from ${at}`)
}

for (const margin of [0, MARGIN]) {
  test.describe(`window scroller (scrollMargin ${margin})`, () => {
    test.beforeEach(async ({ d, page }) => {
      expect(d).toBeTruthy()
      await installAxis(page, 'window', margin)
    })

    test('mounts below the page header and renders only the rows near the window', async ({ d, page }) => {
      const a = axis(page)
      await d.mount({ items: makeItems(2000, 'm', rng(51), 40, 120), align: 'start', layout: 'window', scrollMargin: margin })
      expect(await a.offset()).toBe(0)
      // The list starts after the page's own heading, in normal flow.
      expect(await a.start('m0')).toBeGreaterThan(10)
      const keys = await a.keys()
      expect(keys[0]).toBe('m0')
      expect(keys.length).toBeLessThan(60)
      expect(await d.hasScroller()).toBe(true)
    })

    test('moves rows exactly with the page scroll and renders the rows that come into view', async ({ d, page }) => {
      const a = axis(page)
      await d.mount({ items: makeItems(2000, 'm', rng(52), 40, 120), align: 'start', layout: 'window', scrollMargin: margin, estimate: 80 })
      for (let step = 0; step < 40; step++) {
        const key = await rowFrom(page, 200)
        const before = await a.start(key)
        const delta = await a.scrollBy(300)
        await d.frames(2)
        expect(Math.abs((await a.start(key)) - (before - delta)), `step ${step}`).toBeLessThanOrEqual(TOLERANCE)
      }
      // The rows at the viewport start and end are mounted.
      const view = await a.viewport()
      const keys = await a.keys()
      const starts = await Promise.all(keys.map((k) => a.start(k)))
      const ends = await Promise.all(keys.map((k) => a.end(k)))
      expect(Math.min(...starts)).toBeLessThan(0)
      expect(Math.max(...ends)).toBeGreaterThan(view)
      expect(keys.length).toBeLessThan(60)
    })

    test('keeps a row still through prepends and resizes before it', async ({ d, page }) => {
      const a = axis(page)
      const random = rng(53)
      const items = makeItems(200, 'm', random, 40, 160)
      await d.mount({ items, align: 'start', layout: 'window', scrollMargin: margin, hasMoreStart: true, overscan: 600 })
      await a.scrollBy(4000)
      await d.frames(2)
      // The first row starting inside the viewport; the row two before it is off-screen.
      const anchor = await rowFrom(page, 1)
      const i = items.findIndex((m) => m.id === anchor)
      const before = items[i - 2]!.id
      await stillOnAxis(page, anchor, async () => {
        await d.update({ items: [...makeItems(20, 'p', random, 40, 160), ...items] })
        await d.frames(2)
        expect(await d.isMounted(before)).toBe(true)
        await d.setItemHeight(before, items[i - 2]!.height! + 90)
        await d.frames(4)
      })
    })

    test('scrolls a key to the viewport start, below the scroll margin', async ({ d, page }) => {
      const a = axis(page)
      await d.mount({ items: makeItems(1000, 'm', rng(54), 40, 160), align: 'start', layout: 'window', scrollMargin: margin })
      expect(await d.scrollToKey('m500')).toBe(true)
      await d.frames(4)
      expect(Math.abs(await a.start('m500'))).toBeLessThanOrEqual(1)
      expect(await d.scrollToKey('m300', { align: 'end' })).toBe(true)
      await d.frames(4)
      expect(Math.abs((await a.end('m300')) - (await a.viewport()))).toBeLessThanOrEqual(1)
    })

    test('keeps an already scrolled page where it is when the list mounts (align start)', async ({ d, page }) => {
      const a = axis(page)
      // Page content above and below the list; the page is scrolled before the list mounts.
      const scrollTo = async (y: number): Promise<number> =>
        page.evaluate((y) => {
          for (const where of ['afterbegin', 'beforeend'] as const) {
            document.body.insertAdjacentHTML(where, '<div class="page-filler" style="height:3000px"></div>')
          }
          window.scrollTo(0, y)
          return window.scrollY
        }, y)
      expect(await scrollTo(1500)).toBe(1500)
      await d.mount({ items: makeItems(500, 'm', rng(57), 40, 160), align: 'start', layout: 'window', scrollMargin: margin })
      await d.frames(3)
      // The list is below the viewport: nothing moves.
      expect(await page.evaluate(() => window.scrollY)).toBe(1500)
      expect(await d.isMounted('m0')).toBe(true)
      expect(await d.getSnapshot()).toMatchObject({ pinned: false })
      // Scrolling into the list renders and anchors as usual.
      await a.scrollBy(3000)
      await d.frames(2)
      const anchor = await rowFrom(page, 1)
      await stillOnAxis(page, anchor, async () => {
        await d.update({ items: [...makeItems(10, 'p', rng(58), 40, 160), ...makeItems(500, 'm', rng(57), 40, 160)] })
        await d.frames(3)
      })
    })

    test('pins to the bottom of the page and follows appends (align end)', async ({ d, page }) => {
      const a = axis(page)
      const items = makeItems(300, 'm', rng(55), 40, 160)
      await d.mount({ items, align: 'end', layout: 'window', scrollMargin: margin })
      expect(Math.abs((await a.offset()) - (await a.max()))).toBeLessThanOrEqual(1)
      expect(Math.abs((await a.end('m299')) - (await a.viewport()))).toBeLessThanOrEqual(1)
      await d.update({ items: [...items, ...makeItems(2, 'n', rng(56), 40, 160)] })
      await d.frames(2)
      expect(Math.abs((await a.end('n1')) - (await a.viewport()))).toBeLessThanOrEqual(1)
      // A shorter window keeps the bottom pinned.
      await page.setViewportSize({ width: 1000, height: 500 })
      await d.frames(3)
      expect(Math.abs((await a.end('n1')) - (await a.viewport()))).toBeLessThanOrEqual(1)
    })
  })
}
