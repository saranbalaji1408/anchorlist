import { makeItems, rng } from '../src/data'
import { expect, test } from '../src/harness'

test.describe('edge triggers', () => {
  test('fires onStartReached once per page', async ({ d }) => {
    const random = rng(17)
    let items = makeItems(40, 'm', random)
    await d.mount({ items, hasMoreStart: true })
    expect((await d.events()).startReached).toBe(0)
    await d.scrollToTop(0)
    await d.scrollBy(10)
    await d.scrollBy(-10)
    expect((await d.events()).startReached).toBe(1)
    items = [...makeItems(20, 'p', random, 200, 400), ...items]
    await d.update({ items })
    await d.frames(2)
    // The page pushed the reader far enough down: no immediate refetch.
    expect((await d.events()).startReached).toBe(1)
    await d.scrollToTop(0)
    expect((await d.events()).startReached).toBe(2)
  })

  test('fires onStartReached when the content does not fill the viewport', async ({ d }) => {
    await d.mount({ items: makeItems(3, 'm', rng(18), 20, 40), hasMoreStart: true })
    expect((await d.events()).startReached).toBe(1)
  })

  test('fires onEndReached near the end when hasMoreEnd', async ({ d }) => {
    const items = makeItems(60, 'm', rng(19))
    await d.mount({ items, hasMoreEnd: true, initialSnapshot: { key: 'm5', index: 5, delta: 0, pinned: false } })
    expect((await d.events()).endReached).toBe(0)
    // Rows below were estimated: keep scrolling until the real end.
    for (let i = 0; i < 5; i++) await d.scrollToTop(1e6)
    expect(await d.distanceTo('end')).toBeLessThanOrEqual(1)
    expect((await d.events()).endReached).toBe(1)
  })

  test('reports onAtEdgeChange after mount and when leaving and returning', async ({ d }) => {
    await d.mount({ items: makeItems(60, 'm', rng(43)) })
    expect((await d.events()).atEdge).toEqual([true])
    await d.scrollBy(-500)
    await d.scrollToEdge()
    await d.frames(2)
    expect((await d.events()).atEdge).toEqual([true, false, true])
  })
})

test.describe('sticky overlay', () => {
  test('renders from the visible range and updates on scroll', async ({ d }) => {
    await d.mount({ items: makeItems(60, 'm', rng(20)), sticky: true })
    expect(await d.pillText()).toBe(await d.rowAt(1))
    await d.scrollBy(-900)
    expect(await d.pillText()).toBe(await d.rowAt(1))
  })

  test('does not shift the content (outside the content wrapper)', async ({ d }) => {
    const items = makeItems(60, 'm', rng(44))
    await d.mount({ items, align: 'start', sticky: true })
    expect((await d.rowRect('m0')).top).toBe(0)
    expect(await d.pillText()).toBe('m0')
  })
})
