import type { Item } from '../src/driver'
import { makeItems, rng } from '../src/data'
import { expect, still, test } from '../src/harness'

const VIEWPORT = 600
const append = (items: Item[], n: number, prefix: string, mine = false): Item[] => [
  ...items,
  ...makeItems(n, prefix, rng(99)).map((m) => ({ ...m, mine })),
]

test.describe('follow', () => {
  test('stays pinned when appending at the end and when the last row grows', async ({ d }) => {
    const items = makeItems(40, 'm', rng(12))
    await d.mount({ items })
    const next = append(items, 2, 'n')
    await d.update({ items: next })
    expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    await d.frames(2)
    await still(d, ['fromBottom:n1'], async () => {
      await d.setItemHeight('n1', next[next.length - 1]!.height! + 150)
      await d.frames(4)
    })
    expect(Math.abs((await d.rowRect('n1')).bottom - VIEWPORT)).toBeLessThanOrEqual(1)
  })

  test('does not move when appending while scrolled up', async ({ d }) => {
    const items = makeItems(40, 'm', rng(13))
    await d.mount({ items })
    await d.scrollBy(-800)
    expect((await d.events()).atEdge.slice(-1)).toEqual([false])
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      await d.update({ items: append(items, 3, 'n') })
      await d.frames(3)
    })
    expect(await d.distanceTo('end')).toBeGreaterThan(100)
  })

  test('jumps to the end when follow returns true (the user sent a message)', async ({ d }) => {
    const items = makeItems(40, 'm', rng(14))
    await d.mount({ items, followMine: true })
    await d.scrollBy(-1500)
    await d.update({ items: append(items, 1, 'mine', true) })
    expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    await d.frames(2)
    expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    expect(await d.isAtEdge()).toBe(true)
  })

  test('keeps following through trim+append (sliding window)', async ({ d }) => {
    const random = rng(38)
    let items = makeItems(60, 'm', random)
    await d.mount({ items })
    for (let i = 0; i < 6; i++) {
      items = [...items.slice(4), ...makeItems(4, `s${i}-`, random)]
      await d.update({ items })
      expect(await d.distanceTo('end'), `round ${i}`).toBeLessThanOrEqual(1)
      await d.frames(1)
    }
    await d.frames(2)
    expect(Math.abs((await d.rowRect(items[items.length - 1]!.id)).bottom - VIEWPORT)).toBeLessThanOrEqual(1)
  })

  test('a forced follow survives a trim in the same update', async ({ d }) => {
    const random = rng(39)
    const items = makeItems(60, 'm', random)
    await d.mount({ items, followMine: true })
    await d.scrollBy(-1500)
    await d.update({ items: append(items.slice(10), 1, 'mine', true) })
    expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    await d.frames(2)
    expect(await d.isMounted('mine0')).toBe(true)
    expect(await d.isAtEdge()).toBe(true)
  })

  test('keeps the anchor through trim+append while scrolled up', async ({ d }) => {
    const random = rng(40)
    let items = makeItems(80, 'm', random)
    await d.mount({ items })
    await d.scrollBy(-1200)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      for (let i = 0; i < 3; i++) {
        items = [...items.slice(3), ...makeItems(3, `s${i}-`, random)]
        await d.update({ items })
        await d.frames(1)
      }
      await d.frames(2)
    })
  })
})
