import { makeItems, rng } from '../src/data'
import { expect, still, test } from '../src/harness'

const VIEWPORT = 600

test.describe('prepend (zero drift)', () => {
  test('keeps the anchored row at the exact pixel position (mid-list)', async ({ d }) => {
    const random = rng(3)
    const items = makeItems(60, 'm', random)
    await d.mount({ items, hasMoreStart: true })
    await d.scrollBy(-2500)
    const anchor = await d.rowAt(VIEWPORT / 2)
    const before = (await d.rowRect(anchor)).top
    await still(d, [`top:${anchor}`], async () => {
      await d.update({ items: [...makeItems(20, 'p', random), ...items] })
      expect((await d.rowRect(anchor)).top).toBeCloseTo(before, 2)
      await d.frames(6)
    })
  })

  test('keeps position when prepending at the very top (new rows mount in the same commit)', async ({ d }) => {
    const random = rng(4)
    const items = makeItems(60, 'm', random)
    await d.mount({ items, hasMoreStart: true })
    await d.scrollToTop(0)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      await d.update({ items: [...makeItems(20, 'p', random), ...items] })
      // Rows right above the viewport are mounted already.
      expect(await d.isMounted('p19')).toBe(true)
      await d.frames(6)
    })
  })

  test('stays still on a prepend after a long jump to the top through unmeasured rows', async ({ d }) => {
    const random = rng(24)
    const items = makeItems(300, 'm', random)
    await d.mount({ items, estimate: 450, hasMoreStart: true })
    // The anchor is first captured from (over)estimates, so its estimated position is unreachable once measured.
    await d.scrollToTop(0, 3)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      await d.update({ items: [...makeItems(20, 'p', random), ...items] })
      await d.frames(4)
    })
  })

  test('stays still when prepended rows grow +150px asynchronously', async ({ d }) => {
    const random = rng(5)
    const items = makeItems(60, 'm', random)
    await d.mount({ items, hasMoreStart: true })
    await d.scrollToTop(0)
    const anchor = await d.rowAt(VIEWPORT / 2)
    const page = makeItems(20, 'p', random)
    let grown = ''
    await still(d, [`top:${anchor}`], async () => {
      await d.update({ items: [...page, ...items] })
      const mounted: typeof page = []
      for (const m of page) if (await d.isMounted(m.id)) mounted.push(m)
      expect(mounted.length).toBeGreaterThan(0)
      // "Images" resolve at different times.
      for (const m of mounted) {
        await d.wait(15)
        await d.setItemHeight(m.id, m.height! + 150)
      }
      grown = mounted[mounted.length - 1]!.id
      await d.frames(6)
    })
    expect((await d.rowRect(grown)).height).toBe(page.find((m) => m.id === grown)!.height! + 150)
  })

  test('re-renders no mounted row on a prepend, a trim or an append', async ({ d }) => {
    const random = rng(30)
    const items = makeItems(60, 'm', random)
    await d.mount({ items, hasMoreStart: true })
    await d.scrollBy(-1500)
    const mounted = await d.mountedKeys()
    expect(mounted.length).toBeGreaterThan(3)
    await d.resetCounters()
    const next = [...makeItems(20, 'p', random), ...items.slice(5), ...makeItems(3, 'a', random)]
    await d.update({ items: next })
    await d.frames(3)
    const renders = await d.renders()
    const stillMounted = (await d.mountedKeys()).filter((k) => mounted.includes(k))
    expect(stillMounted.length).toBeGreaterThan(3)
    for (const k of stillMounted) expect(renders[k] ?? 0, k).toBe(0)
  })

  test('keeps the anchor through a prepend rendered in a transition (concurrent React)', async ({ d }) => {
    const random = rng(31)
    const items = makeItems(80, 'm', random)
    await d.mount({ items, hasMoreStart: true })
    await d.scrollBy(-2500)
    const anchor = await d.rowAt(VIEWPORT / 2)
    await still(d, [`top:${anchor}`], async () => {
      let next = items
      for (let i = 0; i < 4; i++) {
        next = [...makeItems(15, `t${i}-`, random), ...next]
        await d.update({ items: next }, 'transition')
        await d.scrollBy(0, 1)
      }
      await d.frames(4)
    })
  })

  test('keeps the anchor in StrictMode through transition prepends interleaved with user scrolls', async ({ d }) => {
    const random = rng(32)
    let items = makeItems(80, 'm', random)
    await d.mount({ items, hasMoreStart: true, strict: true })
    await d.scrollBy(-2500)
    const anchor = await d.rowAt(VIEWPORT / 2)
    for (let i = 0; i < 4; i++) {
      const before = (await d.rowRect(anchor)).top
      items = [...makeItems(10, `t${i}-`, random), ...items]
      await d.update({ items }, 'transition')
      expect(Math.abs((await d.rowRect(anchor)).top - before), `prepend ${i}`).toBeLessThanOrEqual(0.5)
      const delta = await d.scrollBy(-40)
      expect(Math.abs((await d.rowRect(anchor)).top - (before - delta)), `scroll ${i}`).toBeLessThanOrEqual(0.5)
    }
  })
})
