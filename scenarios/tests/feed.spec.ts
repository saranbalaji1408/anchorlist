import { makeItems, rng } from '../src/data'
import { expect, still, test } from '../src/harness'

const VIEWPORT = 600

test.describe('top-anchored feed (align start)', () => {
  test('opens at the start and keeps it while items are appended', async ({ d }) => {
    const random = rng(50)
    const items = makeItems(40, 'f', random)
    await d.mount({ items, align: 'start', footer: 30 })
    expect(await d.scrollTop()).toBe(0)
    await still(d, ['top:f0'], async () => {
      await d.update({ items: [...items, ...makeItems(20, 'n', random)] })
      await d.frames(3)
    })
    expect(await d.isAtEdge('start')).toBe(true)
  })

  test('follows prepends while pinned to the start', async ({ d }) => {
    const random = rng(51)
    const items = makeItems(40, 'f', random)
    await d.mount({ items, align: 'start' })
    await d.update({ items: [...makeItems(3, 'new', random), ...items] })
    expect(await d.scrollTop()).toBe(0)
    await d.frames(2)
    expect((await d.rowRect('new0')).top).toBe(0)
  })

  test('keeps the anchor when items are prepended while scrolled down', async ({ d }) => {
    const random = rng(52)
    const items = makeItems(60, 'f', random)
    await d.mount({ items, align: 'start' })
    await d.scrollBy(2000)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      await d.update({ items: [...makeItems(10, 'new', random), ...items] })
      await d.frames(3)
    })
  })

  test('grows a row downward when it is the anchor (start edge held)', async ({ d }) => {
    const items = makeItems(60, 'f', rng(53))
    await d.mount({ items, align: 'start' })
    await d.scrollBy(1500)
    const anchor = (await d.getSnapshot()).key as string
    await still(d, [`top:${anchor}`], async () => {
      await d.setItemHeight(anchor, (await d.rowRect(anchor)).height + 200)
      await d.frames(3)
    })
  })

  test('fires onEndReached once per page and keeps position when the page arrives', async ({ d }) => {
    const random = rng(54)
    let items = makeItems(40, 'f', random)
    await d.mount({ items, align: 'start', hasMoreEnd: true })
    expect((await d.events()).endReached).toBe(0)
    for (let i = 0; i < 4; i++) await d.scrollToTop(1e6)
    expect((await d.events()).endReached).toBe(1)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      items = [...items, ...makeItems(20, 'n', random, 200, 400)]
      await d.update({ items })
      await d.frames(3)
    })
    expect((await d.events()).endReached).toBe(1)
  })

  test('keeps rows still with gap and padding', async ({ d }) => {
    const random = rng(55)
    const items = makeItems(60, 'f', random)
    await d.mount({ items, align: 'start', gap: 12, paddingStart: 20, paddingEnd: 30 })
    expect((await d.rowRect('f0')).top).toBe(20)
    expect((await d.rowRect('f1')).top).toBe((await d.rowRect('f0')).bottom + 12)
    await d.scrollBy(1500)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      await d.update({ items: [...makeItems(10, 'p', random), ...items, ...makeItems(5, 'a', random)] })
      await d.frames(3)
    })
    await d.scrollToTop(1e6)
    await d.scrollToTop(1e6)
    expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    expect(VIEWPORT - (await d.rowRect('a4')).bottom).toBeCloseTo(30, 0)
  })
})
