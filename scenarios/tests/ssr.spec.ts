import { makeItems, rng } from '../src/data'
import { expect, still, test } from '../src/harness'

test.describe('server rendering and hydration', () => {
  for (const align of ['start', 'end'] as const) {
    test(`server HTML has the rows for initialRect and hydrates without a mismatch (align ${align})`, async ({ d, page }) => {
      const items = makeItems(500, 'm', rng(91), 40, 80)
      const keys = await d.serverRender({ items, align, estimate: 60, initialRect: { width: 400, height: 600 } })
      // 600 px of 60 px estimates: 10 rows from the align edge.
      expect(keys).toEqual(align === 'start' ? items.slice(0, 10).map((m) => m.id) : items.slice(-10).map((m) => m.id))
      // Tag the server nodes: hydration must adopt them, not re-create them.
      await page.evaluate(() => document.querySelectorAll('[data-key]').forEach((e) => ((e as unknown as { tag: boolean }).tag = true)))
      await d.hydrate()
      await d.frames(2)
      const first = keys[align === 'start' ? 0 : keys.length - 1]!
      expect(await page.evaluate((k) => (document.querySelector(`[data-key="${k}"]`) as unknown as { tag?: boolean } | null)?.tag, first)).toBe(true)
      // The engine has taken over: pinned at the align edge, rows indexed, more rows rendered for the overscan.
      expect(await d.isAtEdge(align)).toBe(true)
      expect((await d.mountedKeys()).length).toBeGreaterThan(10)
      expect(await d.rendersWithoutScroller()).toEqual(keys)
      const r = await d.rowRect(first)
      expect(align === 'start' ? Math.abs(r.top) : Math.abs(r.bottom - 600)).toBeLessThanOrEqual(1)
      // And anchors as usual.
      await d.scrollBy(align === 'start' ? 1500 : -1500)
      const anchor = await d.rowAt(100)
      await still(d, [`top:${anchor}`], async () => {
        await d.update({ items: [...makeItems(20, 'p', rng(92)), ...items] })
        await d.frames(3)
      })
    })
  }

  test('without initialRect the server HTML has no rows', async ({ d }) => {
    expect(await d.serverRender({ items: makeItems(50, 'm', rng(93)) })).toEqual([])
    await d.hydrate()
    expect((await d.mountedKeys()).length).toBeGreaterThan(0)
  })
})

test.describe('snapshot restoration', () => {
  for (const align of ['start', 'end'] as const) {
    test(`restores the position with measured sizes after a remount (align ${align})`, async ({ d }) => {
      const items = makeItems(2000, 'm', rng(94), 20, 300)
      await d.mount({ items, align })
      await d.scrollToKey('m1000')
      await d.frames(3)
      await d.scrollBy(-777)
      const anchor = await d.rowAt(50)
      const before = await d.rowRect(anchor)
      const snap = await d.takeSnapshot()
      expect(snap.pinned).toBe(false)
      expect(snap.sizes!.length).toBeGreaterThan(5)
      const json = JSON.parse(JSON.stringify(snap))
      await d.unmount()
      await d.mount({ items, align, initialSnapshot: json })
      await d.frames(2)
      expect(Math.abs((await d.rowRect(anchor)).top - before.top)).toBeLessThanOrEqual(1)
      // Stored rows above are laid out at their measured sizes: scrolling up to them corrects nothing.
      const up = items[Number(anchor.slice(1)) - 3]!.id
      await still(d, [`top:${anchor}`], async () => {
        await d.scrollBy(0)
        await d.frames(4)
      })
      expect((await d.getItemRect(up))?.size).toBe(items.find((m) => m.id === up)!.height)
    })
  }
})
