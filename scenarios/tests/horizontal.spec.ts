import type { Page } from '@playwright/test'
import { axis, installAxis, stillOnAxis, type Layout } from '../src/axis'
import { makeItems, rng } from '../src/data'
import { expect, test, TOLERANCE } from '../src/harness'

// The list is 600 px wide and 200 px tall; item heights are widths.
const WIDTH = 600
const HEIGHT = 200

/** First mounted row whose start is at or past `at` px from the viewport start. */
async function rowFrom(page: Page, at: number): Promise<string> {
  const a = axis(page)
  for (const key of await a.keys()) if ((await a.start(key)) >= at) return key
  throw new Error(`no row from ${at}`)
}

for (const layout of ['horizontal', 'rtl'] as Layout[]) {
  test.describe(`${layout} list`, () => {
    // `d` loads the fixture page first.
    test.beforeEach(async ({ d, page }) => {
      expect(d).toBeTruthy()
      await installAxis(page, layout)
    })

    test('mounts at the start edge with the first row there (align start)', async ({ d, page }) => {
      const a = axis(page)
      await d.mount({ items: makeItems(200, 'm', rng(41), 40, 200), align: 'start', layout, width: WIDTH, height: HEIGHT })
      expect(Math.abs(await a.offset())).toBe(0)
      expect(Math.abs(await a.start('m0'))).toBeLessThanOrEqual(TOLERANCE)
      // Rows run along the axis: each starts where the previous one ends.
      expect(Math.abs((await a.start('m1')) - (await a.end('m0')))).toBeLessThanOrEqual(TOLERANCE)
      expect((await a.keys()).length).toBeLessThan(40)
      if (layout === 'rtl') {
        // The start edge is the right edge.
        const right = await page.evaluate(() => {
          const sc = document.getElementById('scroller')!.getBoundingClientRect()
          const row = document.querySelector('[data-key="m0"]')!.getBoundingClientRect()
          return sc.right - row.right
        })
        expect(Math.abs(right)).toBeLessThanOrEqual(TOLERANCE)
      }
    })

    test('mounts at the end edge and follows appends (align end)', async ({ d, page }) => {
      const a = axis(page)
      const items = makeItems(200, 'm', rng(42), 40, 200)
      await d.mount({ items, align: 'end', layout, width: WIDTH, height: HEIGHT })
      expect(Math.abs((await a.offset()) - (await a.max()))).toBeLessThanOrEqual(1)
      expect(Math.abs((await a.end('m199')) - WIDTH)).toBeLessThanOrEqual(1)
      await d.update({ items: [...items, ...makeItems(3, 'n', rng(43), 40, 200)] })
      await d.frames(2)
      expect(Math.abs((await a.end('n2')) - WIDTH)).toBeLessThanOrEqual(1)
    })

    test('moves rows exactly by a user scroll, through unmeasured rows', async ({ d, page }) => {
      const a = axis(page)
      await d.mount({ items: makeItems(400, 'm', rng(44), 40, 200), align: 'start', layout, width: WIDTH, height: HEIGHT, estimate: 100 })
      for (let step = 0; step < 30; step++) {
        const key = await rowFrom(page, WIDTH / 3)
        const before = await a.start(key)
        const delta = await a.scrollBy(400)
        await d.frames(2)
        expect(Math.abs((await a.start(key)) - (before - delta)), `step ${step}`).toBeLessThanOrEqual(TOLERANCE)
      }
      expect(await a.offset()).toBeGreaterThan(5000)
    })

    test('keeps a row still through prepends and resizes before it', async ({ d, page }) => {
      const a = axis(page)
      const random = rng(45)
      const items = makeItems(120, 'm', random, 40, 200)
      await d.mount({ items, align: 'end', layout, width: WIDTH, height: HEIGHT, hasMoreStart: true, overscan: 600 })
      await a.scrollBy(-2500)
      await d.frames(2)
      // The first row starting inside the viewport; the row two before it is off-screen.
      const anchor = await rowFrom(page, 1)
      const i = items.findIndex((m) => m.id === anchor)
      const before = items[i - 2]!.id
      await stillOnAxis(page, anchor, async () => {
        await d.update({ items: [...makeItems(20, 'p', random, 40, 200), ...items] })
        await d.frames(2)
        // A mounted row before the viewport (in the overscan) grows by 80 px.
        expect(await d.isMounted(before)).toBe(true)
        await d.setItemHeight(before, items[i - 2]!.height! + 80)
        await d.frames(4)
      })
    })

    test('lays out a header, gaps and padding along the axis and keeps a row still when the header grows', async ({ d, page }) => {
      const a = axis(page)
      const items = makeItems(100, 'm', rng(47), 40, 200)
      await d.mount({ items, align: 'start', layout, width: WIDTH, height: HEIGHT, header: 120, gap: 8, paddingStart: 10 })
      // The header comes first along the axis, then the padding.
      expect(Math.abs((await a.start('m0')) - 130)).toBeLessThanOrEqual(TOLERANCE)
      expect(Math.abs((await a.start('m1')) - (await a.end('m0')) - 8)).toBeLessThanOrEqual(TOLERANCE)
      await a.scrollBy(1500)
      await d.frames(2)
      const anchor = await rowFrom(page, WIDTH / 2)
      await stillOnAxis(page, anchor, async () => {
        await d.update({ header: 300 })
        await d.frames(4)
      })
    })

    test('scrolls to a key at the start and at the end', async ({ d, page }) => {
      const a = axis(page)
      await d.mount({ items: makeItems(300, 'm', rng(46), 40, 200), align: 'start', layout, width: WIDTH, height: HEIGHT })
      expect(await d.scrollToKey('m150')).toBe(true)
      await d.frames(4)
      expect(Math.abs(await a.start('m150'))).toBeLessThanOrEqual(1)
      expect(await d.scrollToKey('m40', { align: 'end' })).toBe(true)
      await d.frames(4)
      expect(Math.abs((await a.end('m40')) - WIDTH)).toBeLessThanOrEqual(1)
      await d.scrollToEdge('end')
      await d.frames(4)
      expect(Math.abs((await a.offset()) - (await a.max()))).toBeLessThanOrEqual(1)
      expect(await d.isAtEdge('end')).toBe(true)
    })
  })
}
