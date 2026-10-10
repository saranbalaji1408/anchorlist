import { makeItems, rng } from '../src/data'
import { expect, still, test, TOLERANCE } from '../src/harness'

const VIEWPORT = 600

test.describe('scrolling', () => {
  test('moves visible rows exactly by the scroll delta through unmeasured rows', async ({ d }) => {
    const items = makeItems(400, 'm', rng(9))
    await d.mount({ items, estimate: 50 })
    expect((await d.getItemRect('m330'))?.measured).toBe(false)
    // About 80 steps of 250 px go far beyond the rows measured during mount.
    for (let step = 0; step < 80; step++) {
      if ((await d.scrollTop()) < 300) break
      const key = await d.rowAt(VIEWPORT / 2)
      const before = (await d.rowRect(key)).top
      const delta = await d.scrollBy(-250)
      expect(Math.abs((await d.rowRect(key)).top - (before - delta)), `step ${step}`).toBeLessThanOrEqual(TOLERANCE)
    }
    expect((await d.getItemRect('m330'))?.measured).toBe(true)
  })

  test('keeps following rows still when an item above the anchor or the anchor itself is removed', async ({ d }) => {
    let items = makeItems(60, 'm', rng(10))
    await d.mount({ items, overscan: 800 })
    await d.scrollBy(-1500)
    const anchor = await d.rowAt(1)
    const i = items.findIndex((m) => m.id === anchor)
    const above = items[i - 2]!.id
    expect(await d.isMounted(above)).toBe(true)
    const follower = items[i + 1]!.id
    await still(d, [`top:${follower}`], async () => {
      items = items.filter((m) => m.id !== above)
      await d.update({ items })
      await d.frames(2)
      // Remove the anchor row itself (for example an unread marker).
      items = items.filter((m) => m.id !== anchor)
      await d.update({ items })
      await d.frames(3)
    })
  })

  test('keeps the view when the anchor and its neighbours are removed (start-aligned)', async ({ d }) => {
    let items = makeItems(80, 'm', rng(36))
    await d.mount({ items, align: 'start' })
    await d.scrollBy(2000)
    const anchor = (await d.getSnapshot()).key as string
    const i = items.findIndex((m) => m.id === anchor)
    const gone = new Set(items.slice(i - 1, i + 2).map((m) => m.id))
    const survivor = items[i + 3]!.id
    await still(d, [`top:${survivor}`], async () => {
      items = items.filter((m) => !gone.has(m.id))
      await d.update({ items })
      await d.frames(3)
    })
    expect(await d.isAtEdge('start')).toBe(false)
  })

  test('keeps the anchor when items are inserted in the middle, above and below it', async ({ d }) => {
    const random = rng(37)
    let items = makeItems(120, 'm', random)
    await d.mount({ items })
    await d.scrollBy(-3000)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      const i = items.findIndex((m) => m.id === anchor)
      items = [...items.slice(0, i - 3), ...makeItems(4, 'x', random), ...items.slice(i - 3)]
      await d.update({ items })
      await d.frames(2)
      const j = items.findIndex((m) => m.id === anchor)
      items = [...items.slice(0, j + 2), ...makeItems(4, 'y', random), ...items.slice(j + 2)]
      await d.update({ items })
      await d.frames(2)
      // Far above, outside the rendered range.
      items = [...items.slice(0, 5), ...makeItems(10, 'z', random), ...items.slice(5)]
      await d.update({ items })
      await d.frames(3)
    })
  })

  test('bounds the number of mounted rows', async ({ d }) => {
    const items = makeItems(5000, 'm', rng(11), 40, 80)
    await d.mount({ items })
    // A 600 px viewport plus 400 px overscan on each side holds at most ~40 rows of >= 40 px.
    expect((await d.mountedKeys()).length).toBeLessThanOrEqual(45)
    await d.scrollToIndex(2500, { align: 'center' })
    await d.frames(3)
    expect((await d.mountedKeys()).length).toBeLessThanOrEqual(45)
    expect(await d.isMounted('m2500')).toBe(true)
    await d.scrollBy(-3000)
    expect((await d.mountedKeys()).length).toBeLessThanOrEqual(45)
  })
})

test.describe('user movement', () => {
  // A commit that lands after a user scroll but before its `scroll` event is
  // dispatched must keep the scroll.
  test('keeps a user scroll that lands just before an unrelated re-render', async ({ d, page }) => {
    await d.mount({ items: makeItems(80, 'm', rng(3)) })
    await d.scrollBy(-2000)
    const anchor = await d.rowAt(300)
    const before = (await d.rowRect(anchor)).top
    await page.evaluate(() => {
      document.getElementById('scroller')!.scrollTop -= 40
      void window.__driver.update({ header: null })
    })
    await d.frames(2)
    expect(Math.abs((await d.rowRect(anchor)).top - (before + 40))).toBeLessThanOrEqual(TOLERANCE)
  })
})
