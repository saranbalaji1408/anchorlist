import { makeItems, makeTextItems, rng } from '../src/data'
import { expect, still, test } from '../src/harness'

const VIEWPORT = 600

test.describe('resizes', () => {
  test('does not move visible rows when rows above the viewport resize', async ({ d }) => {
    const items = makeItems(80, 'm', rng(6))
    await d.mount({ items })
    await d.scrollBy(-3000)
    const anchor = await d.rowAt(VIEWPORT / 2)
    const index = items.findIndex((m) => m.id === anchor)
    const above: typeof items = []
    for (const m of items.slice(0, index)) {
      if ((await d.isMounted(m.id)) && (await d.rowRect(m.id)).bottom < 0) above.push(m)
    }
    expect(above.length).toBeGreaterThan(1)
    await still(d, [`top:${anchor}`], async () => {
      for (const [i, m] of above.entries()) {
        await d.setItemHeight(m.id, i % 2 ? m.height! + 137 : Math.max(5, m.height! - 60))
        await d.frames(1)
      }
      await d.frames(4)
    })
  })

  test('keeps the bottom content fixed when the viewport shrinks (end-aligned)', async ({ d }) => {
    const items = makeItems(80, 'm', rng(7))
    await d.mount({ items })
    await d.scrollBy(-1200)
    const key = await d.rowAt(VIEWPORT - 50)
    const before = (await d.rowRect(key)).bottom - VIEWPORT
    await still(d, [`fromBottom:${key}`], async () => {
      await d.update({ height: 420 })
      await d.frames(4)
    })
    expect((await d.rowRect(key)).bottom - 420).toBeCloseTo(before, 0)
  })

  test('keeps the top content fixed when the viewport shrinks (start-aligned)', async ({ d }) => {
    const items = makeItems(80, 'm', rng(7))
    await d.mount({ items, align: 'start' })
    await d.scrollBy(1500)
    const key = await d.rowAt(50)
    await still(d, [`top:${key}`], async () => {
      await d.update({ height: 420 })
      await d.frames(3)
      await d.update({ height: 600 })
      await d.frames(3)
    })
  })

  test('keeps the anchor when the header toggles', async ({ d }) => {
    const items = makeItems(60, 'm', rng(8))
    await d.mount({ items })
    await d.scrollBy(-1500)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      await d.update({ header: 64 })
      await d.frames(2)
      await d.update({ header: null })
      await d.frames(2)
    })
  })

  test('keeps the anchor while the header and footer resize', async ({ d }) => {
    const items = makeItems(60, 'm', rng(33))
    await d.mount({ items, header: 40, footer: 40, align: 'start' })
    await d.scrollBy(1500)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      for (const h of [120, 10, 300, 0, 80]) {
        await d.update({ header: h, footer: 200 - h / 2 })
        await d.frames(1)
      }
      await d.frames(3)
    })
  })

  test('stays pinned to the end while the footer grows (end-aligned)', async ({ d }) => {
    const items = makeItems(60, 'm', rng(34))
    await d.mount({ items, footer: 20 })
    for (const h of [60, 140, 30]) {
      await d.update({ footer: h })
      await d.frames(2)
      expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    }
  })

  test('re-measures rows in the same frame when the width changes', async ({ d }) => {
    const items = makeTextItems(120, 't', rng(35))
    await d.mount({ items })
    await d.scrollBy(-2000)
    // The anchor is the first row reaching into the viewport; rows below it reflow too.
    const anchor = (await d.getSnapshot()).key as string
    const contentBefore = await d.scrollHeight()
    await still(d, [`bottom:${anchor}`], async () => {
      await d.update({ width: 260 })
      await d.frames(3)
    })
    // Text reflowed: rows really changed size, and the anchored edge did not move.
    expect(await d.scrollHeight()).toBeGreaterThan(contentBefore)
    await still(d, [`bottom:${anchor}`], async () => {
      await d.update({ width: 400 })
      await d.frames(3)
    })
  })
})
