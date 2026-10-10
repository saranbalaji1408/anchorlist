import type { Page } from '@playwright/test'
import { makeItems, rng } from '../src/data'
import { expect, still, test } from '../src/harness'

/** Focuses the content of row `key` (made focusable) and tags its row node to check identity later. */
const focusRow = (page: Page, key: string): Promise<void> =>
  page.evaluate((k) => {
    const row = document.querySelector<HTMLElement>(`#scroller [data-key="${k}"]`)!
    ;(row as unknown as { tag: string }).tag = k
    const el = row.firstElementChild as HTMLElement
    el.tabIndex = -1
    el.focus({ preventScroll: true })
  }, key)

/** The focused row: key, whether it is the tagged node, its position style and whether focus is inside it. */
const focused = (page: Page, key: string) =>
  page.evaluate((k) => {
    const row = document.querySelector<HTMLElement>(`#scroller [data-key="${k}"]`)
    return {
      mounted: !!row,
      same: (row as unknown as { tag?: string } | null)?.tag === k,
      position: row?.style.position ?? null,
      hasFocus: !!row && row.contains(document.activeElement),
      posinset: row?.getAttribute('aria-posinset') ?? null,
    }
  }, key)

test.describe('focus preservation', () => {
  for (const align of ['start', 'end'] as const) {
    test(`the focused row stays mounted and focused while scrolled far away (align ${align})`, async ({ d, page }) => {
      const items = makeItems(2000, 'm', rng(71))
      await d.mount({ items, align })
      const key = align === 'start' ? 'm2' : 'm1997'
      await focusRow(page, key)
      // Far away, by user scrolls.
      for (let i = 0; i < 10; i++) await d.scrollBy(align === 'start' ? 3000 : -3000, 1)
      await d.frames(2)
      const away = await focused(page, key)
      expect(away).toMatchObject({ mounted: true, same: true, position: 'absolute', hasFocus: true })
      expect(away.posinset).toBe(String(Number(key.slice(1)) + 1))
      // It is out of the viewport and does not cover the visible rows.
      const r = await d.rowRect(key)
      expect(r.bottom <= 0 || r.top >= 600).toBe(true)
      // Back in range: the same node, in flow, still focused.
      await d.scrollToEdge(align)
      await d.frames(3)
      expect(await focused(page, key)).toMatchObject({ mounted: true, same: true, position: '', hasFocus: true })
    })
  }

  test('a kept focused row does not disturb anchoring through a prepend', async ({ d, page }) => {
    const items = makeItems(1000, 'm', rng(72))
    await d.mount({ items, align: 'start' })
    await focusRow(page, 'm1')
    await d.scrollToKey('m500')
    await d.frames(3)
    expect((await focused(page, 'm1')).position).toBe('absolute')
    await still(d, ['top:m500'], async () => {
      await d.update({ items: [...makeItems(40, 'p', rng(73)), ...items] })
      await d.frames(3)
    })
    expect(await focused(page, 'm1')).toMatchObject({ mounted: true, same: true, hasFocus: true, posinset: '42' })
  })

  test('the row unmounts normally once focus leaves the list', async ({ d, page }) => {
    await d.mount({ items: makeItems(1000, 'm', rng(74)), align: 'start' })
    await focusRow(page, 'm1')
    await page.evaluate(() => (document.activeElement as HTMLElement).blur())
    await d.scrollToKey('m500')
    await d.frames(3)
    expect(await d.isMounted('m1')).toBe(false)
  })

  test('aria-busy follows the busy prop', async ({ d, page }) => {
    await d.mount({ items: makeItems(50, 'm', rng(75)), busy: true })
    const busy = (): Promise<string | null> => page.evaluate(() => document.querySelector('#scroller [role="list"]')!.getAttribute('aria-busy'))
    expect(await busy()).toBe('true')
    await d.update({ busy: false })
    expect(await busy()).not.toBe('true')
  })
})
