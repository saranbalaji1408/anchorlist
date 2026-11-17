import type { Item } from '../src/driver'
import { makeItems, rng } from '../src/data'
import { expect, recordDrift, spread, test, TOLERANCE } from '../src/harness'

for (const align of ['end', 'start'] as const) {
  test(`keeps the anchor still through random prepends, appends, resizes, removals and header toggles (${align})`, async ({ d }) => {
    test.setTimeout(90_000)
    const random = rng(align === 'end' ? 7 : 8)
    let items: Item[] = makeItems(80, 'm', random)
    let header = false
    const hasMore = align === 'end' ? { hasMoreStart: true } : { hasMoreEnd: true }
    await d.mount({ items, align, estimate: 100, ...hasMore })
    if (align === 'start') await d.scrollBy(3000)
    const heights = new Map(items.map((m) => [m.id, m.height!]))
    const resize = async (index: number, delta: number): Promise<string> => {
      const m = items[index]
      if (!m) return ''
      const h = Math.max(10, (heights.get(m.id) ?? m.height!) + delta)
      heights.set(m.id, h)
      await d.setItemHeight(m.id, h)
      return `resize ${m.id} ${delta}`
    }
    let checked = 0
    for (let step = 0; step < 80; step++) {
      const op = Math.floor(random() * 8)
      const snap = await d.getSnapshot()
      if (op === 0 || snap.pinned || snap.key === null || !(await d.isMounted(String(snap.key)))) {
        await d.scrollBy(Math.round((random() - (align === 'end' ? 0.6 : 0.4)) * 1500))
        continue
      }
      const key = String(snap.key)
      const index = items.findIndex((m) => m.id === key)
      const above = Math.max(0, index - 1 - Math.floor(random() * 5))
      // Shrinking or removing above the anchor needs room to scroll into.
      const roomy = (await d.scrollTop()) > 1500 && (await d.distanceTo('end')) > 1500
      await d.startSampler([`${align === 'end' ? 'bottom' : 'top'}:${key}`])
      await d.frames(1)
      let operation = ''
      if (op === 1) {
        items = [...makeItems(20, `p${step}-`, random), ...items]
        operation = 'prepend'
      } else if (op === 2) {
        items = [...items, ...makeItems(2, `a${step}-`, random)]
        operation = 'append'
      } else if (op === 3) {
        operation = await resize(above, 150)
      } else if (op === 4 && roomy) {
        operation = await resize(above, -100)
      } else if (op === 5 && roomy && index > 1) {
        operation = `remove ${items[index - 1]?.id}`
        items = items.filter((_, i) => i !== index - 1)
      } else if (op === 6) {
        header = !header
        operation = 'header'
      } else if (op === 7) {
        operation = await resize(Math.min(items.length - 1, index + 1), 120)
      }
      await d.update({ items, header: header ? 50 : null })
      await d.frames(3)
      const samples = await d.stopSampler()
      if (!operation) continue
      checked++
      const drift = spread(samples)
      recordDrift(drift, `step ${step}: ${operation}`)
      expect(drift, `step ${step}: ${operation}`).toBeLessThanOrEqual(TOLERANCE)
    }
    expect(checked).toBeGreaterThan(30)
  })
}
