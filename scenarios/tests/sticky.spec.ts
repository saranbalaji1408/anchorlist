import type { Page } from '@playwright/test'
import { makeItems, rng } from '../src/data'
import type { Item } from '../src/driver'
import { expect, still, test } from '../src/harness'

/** 600 items; every 25th (m0, m25, m50, ...) is a 40 px group header. */
const grouped = (): Item[] => makeItems(600, 'm', rng(61), 20, 120).map((m, i) => (i % 25 ? m : { ...m, height: 40, header: true }))

interface Stuck {
  text: string | null
  top: number
  bottom: number
  hidden: boolean
  inert: boolean
  inList: boolean
}

/** The stuck copy relative to the viewport top, or null when nothing sticks. */
const stuck = (page: Page): Promise<Stuck | null> =>
  page.evaluate(() => {
    const sc = document.getElementById('scroller')!
    const el = sc.querySelector('[data-testid="stuck"]')
    if (!el) return null
    const top = sc.getBoundingClientRect().top
    const r = el.getBoundingClientRect()
    return {
      text: el.textContent,
      top: r.top - top,
      bottom: r.bottom - top,
      hidden: !!el.closest('[aria-hidden="true"]'),
      inert: !!el.closest('[inert]'),
      inList: !!el.closest('[role="list"]'),
    }
  })

test.describe('sticky items', () => {
  test('stick the current group header over the rows without moving them', async ({ d, page }) => {
    await d.mount({ items: grouped(), align: 'start', stickyItems: true })
    expect(await d.scrollToKey('m60')).toBe(true)
    await d.frames(3)
    const s = await stuck(page)
    expect(s).toMatchObject({ text: 'm50', hidden: true, inert: true, inList: false })
    expect(Math.abs(s!.top)).toBeLessThanOrEqual(1)
    expect(s!.bottom - s!.top).toBeCloseTo(40, 0)
    // The copy is an overlay: the rows keep their positions.
    expect(Math.abs((await d.rowRect('m60')).top)).toBeLessThanOrEqual(1)
  })

  test('the next header pushes the stuck one out, then takes its place', async ({ d, page }) => {
    await d.mount({ items: grouped(), align: 'start', stickyItems: true })
    expect(await d.scrollToKey('m75', { offset: -20 })).toBe(true)
    await d.frames(3)
    const next = await d.rowRect('m75')
    expect(Math.abs(next.top - 20)).toBeLessThanOrEqual(1)
    const pushed = await stuck(page)
    expect(pushed?.text).toBe('m50')
    expect(Math.abs(pushed!.bottom - next.top)).toBeLessThanOrEqual(1)
    // Scroll on like a user, a few px per frame: the copy never overlaps the next header.
    for (let i = 0; i < 8; i++) {
      await d.scrollBy(5, 1)
      const s = await stuck(page)
      const top = (await d.rowRect('m75')).top
      if (top > 0) {
        expect(s?.text).toBe('m50')
        expect(s!.bottom).toBeLessThanOrEqual(top + 1)
      } else expect(s?.text).toBe('m75')
    }
    await d.scrollToKey('m80')
    await d.frames(3)
    const s = await stuck(page)
    expect(s?.text).toBe('m75')
    expect(Math.abs(s!.top)).toBeLessThanOrEqual(1)
  })

  test('keeps a header that is no longer mounted stuck', async ({ d, page }) => {
    await d.mount({ items: grouped(), align: 'start', stickyItems: true })
    await d.scrollToKey('m98')
    await d.frames(3)
    expect(await d.isMounted('m75')).toBe(false)
    const s = await stuck(page)
    expect(s?.text).toBe('m75')
    expect(Math.abs(s!.top)).toBeLessThanOrEqual(1)
  })

  test('shows nothing while the first header is below the viewport start', async ({ d, page }) => {
    await d.mount({ items: grouped(), align: 'start', stickyItems: true, header: 80 })
    expect(await stuck(page)).toBeNull()
    await d.scrollBy(100)
    expect((await stuck(page))?.text).toBe('m0')
  })

  test('anchoring holds through a prepend while a header is stuck', async ({ d, page }) => {
    const items = grouped()
    await d.mount({ items, align: 'start', stickyItems: true })
    await d.scrollToKey('m60')
    await d.frames(3)
    await still(d, ['top:m60'], async () => {
      await d.update({ items: [...makeItems(30, 'p', rng(62)), ...items] })
      await d.frames(3)
    })
    expect((await stuck(page))?.text).toBe('m50')
  })
})
