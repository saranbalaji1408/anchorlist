import type { Page } from '@playwright/test'
import { axis, installAxis, stillOnAxis } from '../src/axis'
import { makeItems, rng } from '../src/data'
import type { Item } from '../src/driver'
import { expect, test, TOLERANCE } from '../src/harness'

// A 600 px tall, 400 px wide list with 3 lanes and an 8 px gap.
const LANES = 3
const GAP = 8
const HEIGHT = 600

type Kind = 'grid' | 'masonry'

/** Reference layout: main-axis start and lane of every item. */
function layout(kind: Kind, items: Item[]): Map<string, { start: number; lane: number }> {
  const out = new Map<string, { start: number; lane: number }>()
  const ends = new Array<number>(LANES).fill(0)
  let top = 0
  items.forEach((m, i) => {
    const h = m.height!
    if (kind === 'masonry') {
      const lane = ends.indexOf(Math.min(...ends))
      out.set(m.id, { start: ends[lane]!, lane })
      ends[lane]! += h + GAP
    } else {
      const lane = i % LANES
      if (i && !lane) top += Math.max(...items.slice(i - LANES, i).map((x) => x.height!)) + GAP
      out.set(m.id, { start: top, lane })
    }
  })
  return out
}

/** Mounted cells: key, start relative to the list, lane from the left offset, and the viewport-relative box. */
const cells = (page: Page) =>
  page.evaluate(
    ([lanes, gap]) => {
      const list = document.querySelector<HTMLElement>('#scroller [role="list"]')!.getBoundingClientRect()
      const view = document.getElementById('scroller')!.getBoundingClientRect()
      const width = (list.width - (lanes - 1) * gap) / lanes
      return Array.from(document.querySelectorAll<HTMLElement>('#scroller [data-key]')).map((el) => {
        const r = el.getBoundingClientRect()
        return {
          key: el.dataset.key!,
          start: r.top - list.top,
          lane: Math.round((r.left - list.left) / (width + gap)),
          width: r.width,
          top: r.top - view.top,
          bottom: r.bottom - view.top,
        }
      })
    },
    [LANES, GAP] as const,
  )

for (const kind of ['grid', 'masonry'] as Kind[]) {
  test.describe(`${kind} lanes`, () => {
    test.beforeEach(async ({ d, page }) => {
      expect(d).toBeTruthy()
      await installAxis(page, 'vertical')
    })

    const mount = (d: { mount: (c: never) => Promise<void> }, items: Item[], extra: object = {}) =>
      d.mount({ items, align: 'start', height: HEIGHT, lanes: { kind, lanes: LANES, gap: GAP }, ...extra } as never)

    test('positions mounted items in lanes like the reference layout, and covers the viewport', async ({ d, page }) => {
      const items = makeItems(300, 'm', rng(61), 40, 200)
      await mount(d, items)
      const ref = layout(kind, items)
      const check = async (): Promise<void> => {
        const mounted = await cells(page)
        expect(mounted.length).toBeGreaterThan(LANES)
        for (const c of mounted) {
          const r = ref.get(c.key)!
          expect(Math.abs(c.start - r.start), c.key).toBeLessThanOrEqual(TOLERANCE)
          expect(c.lane, c.key).toBe(r.lane)
          expect(Math.abs(c.width - (400 - (LANES - 1) * GAP) / LANES)).toBeLessThanOrEqual(TOLERANCE)
        }
        // Every item intersecting the viewport is mounted.
        const offset = await axis(page).offset()
        const keys = new Set(mounted.map((c) => c.key))
        for (const m of items) {
          const r = ref.get(m.id)!
          if (r.start < offset + HEIGHT && r.start + m.height! > offset) expect(keys.has(m.id), m.id).toBe(true)
        }
      }
      await check()
      // Scrolling measures every item on the way, so the layout stays exact.
      for (let step = 0; step < 12; step++) {
        await axis(page).scrollBy(350)
        await d.frames(2)
        await check()
      }
    })

    test('never overlaps items and fills the viewport after jumps over unmeasured items', async ({ d, page }) => {
      await mount(d, makeItems(1000, 'm', rng(65), 40, 200))
      for (const to of [12000, 30000, 6000]) {
        await d.scrollToTop(to, 3)
        const mounted = await cells(page)
        // Unmeasured items are estimated, so a far jump may clamp at the end, where lanes end unevenly.
        const atEnd = await d.isAtEdge('end')
        for (let lane = 0; lane < LANES; lane++) {
          const column = mounted.filter((c) => c.lane === lane).sort((x, y) => x.top - y.top)
          for (let i = 1; i < column.length; i++) expect(column[i]!.top).toBeGreaterThanOrEqual(column[i - 1]!.bottom - TOLERANCE)
          // Items reach above and below the viewport in every lane.
          expect(column[0]!.top, `lane ${lane} at ${to}`).toBeLessThanOrEqual(0)
          if (!atEnd) expect(column[column.length - 1]!.bottom, `lane ${lane} at ${to}`).toBeGreaterThanOrEqual(HEIGHT)
        }
      }
    })

    test('moves items exactly by a user scroll', async ({ d, page }) => {
      const a = axis(page)
      await mount(d, makeItems(400, 'm', rng(62), 40, 200), { estimate: 100 })
      for (let step = 0; step < 25; step++) {
        const key = (await cells(page)).find((c) => c.top >= 100 && c.top < 300)!.key
        const before = await a.start(key)
        const delta = await a.scrollBy(300)
        await d.frames(2)
        expect(Math.abs((await a.start(key)) - (before - delta)), `step ${step}`).toBeLessThanOrEqual(TOLERANCE)
      }
    })

    test('keeps an item still through prepends and resizes above the viewport', async ({ d, page }) => {
      const random = rng(63)
      let items = makeItems(200, 'm', random, 40, 200)
      await mount(d, items, { hasMoreStart: true, overscan: 600 })
      await d.scrollToTop(5000, 3)
      const visible = (await cells(page)).filter((c) => c.top >= 0 && c.top < 200)
      const anchor = visible.sort((x, y) => x.top - y.top)[0]!.key
      const above = (await cells(page)).filter((c) => c.bottom < 0).map((c) => c.key)
      await stillOnAxis(page, anchor, async () => {
        // A whole number of rows keeps a grid's rows; masonry re-lays out.
        items = [...makeItems(LANES * 4, 'p', random, 40, 200), ...items]
        await d.update({ items })
        await d.frames(3)
        await d.setItemHeight(above[0]!, 260)
        await d.frames(4)
      })
    })

    test('keeps a focused item mounted at its lane position when it scrolls far away', async ({ d, page }) => {
      const items = makeItems(600, 'm', rng(66), 40, 200)
      await mount(d, items)
      await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('#scroller [data-key="m4"]')!.firstElementChild as HTMLElement
        el.tabIndex = -1
        el.focus({ preventScroll: true })
      })
      for (let i = 0; i < 10; i++) {
        await axis(page).scrollBy(1500)
        await d.frames(1)
      }
      await d.frames(2)
      const state = await page.evaluate(() => {
        const row = document.querySelector<HTMLElement>('#scroller [data-key="m4"]')
        return { position: row?.style.position, focus: !!row?.contains(document.activeElement) }
      })
      expect(state).toEqual({ position: 'absolute', focus: true })
      // Still at its place in the lanes, which every item before it (measured on mount) fixes.
      const cell = (await cells(page)).find((c) => c.key === 'm4')!
      const ref = layout(kind, items).get('m4')!
      expect(Math.abs(cell.start - ref.start)).toBeLessThanOrEqual(TOLERANCE)
      expect(cell.lane).toBe(ref.lane)
      expect(cell.bottom).toBeLessThan(0)
    })

    test('scrolls to a key and pins to the end (align end)', async ({ d, page }) => {
      const a = axis(page)
      const items = makeItems(300, 'm', rng(64), 40, 200)
      await mount(d, items)
      expect(await d.scrollToKey('m150')).toBe(true)
      await d.frames(4)
      expect(Math.abs(await a.start('m150'))).toBeLessThanOrEqual(1)
      await d.scrollToEdge('end')
      await d.frames(4)
      expect(Math.abs((await a.offset()) - (await a.max()))).toBeLessThanOrEqual(1)
      // The list ends at the end of the longest lane.
      const ends = await cells(page)
      expect(Math.abs(Math.max(...ends.map((c) => c.bottom)) - HEIGHT)).toBeLessThanOrEqual(1)
    })
  })
}
