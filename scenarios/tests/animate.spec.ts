import { makeItems, rng } from '../src/data'
import { expect, test } from '../src/harness'

const VIEWPORT = 600

test.describe('animateToKey', () => {
  for (const align of ['start', 'center', 'end'] as const) {
    test(`scrolls smoothly to an unmounted row 2000 rows away and lands exactly (align ${align})`, async ({ d }) => {
      await d.mount({ items: makeItems(3000, 'm', rng(81)), align: 'start' })
      expect(await d.isMounted('m2000')).toBe(false)
      await d.startSampler(['scrollTop'])
      const t = Date.now()
      expect(await d.animateToKey('m2000', { align, duration: 400 })).toBe(true)
      const elapsed = Date.now() - t
      const samples = (await d.stopSampler()).map((s) => s[0]!)
      // Animated over its duration, not a jump. The progress is time-based, so a slow machine
      // paints fewer frames (4 on a loaded CI WebKit) of the same motion: count positions between
      // the start and the target, not frames.
      expect(elapsed).toBeGreaterThanOrEqual(350)
      const first = samples[0]!
      const last = samples[samples.length - 1]!
      expect(samples.filter((v) => v > first + 1 && v < last - 1).length).toBeGreaterThanOrEqual(1)
      // Always moving forward.
      for (let i = 1; i < samples.length; i++) expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]! - 1)
      await d.frames(3)
      const row = await d.rowRect('m2000')
      const error = align === 'start' ? row.top : align === 'end' ? row.bottom - VIEWPORT : (row.top + row.bottom - VIEWPORT) / 2
      expect(Math.abs(error)).toBeLessThanOrEqual(1)
    })
  }

  test('scrolls upwards in a chat list and applies the offset', async ({ d }) => {
    await d.mount({ items: makeItems(3000, 'm', rng(82)) })
    expect(await d.animateToKey('m100', { offset: -30, duration: 300 })).toBe(true)
    await d.frames(3)
    expect(Math.abs((await d.rowRect('m100')).top - 30)).toBeLessThanOrEqual(1)
    expect(await d.isAtEdge()).toBe(false)
  })

  test('user input cancels it where it is', async ({ d }) => {
    await d.mount({ items: makeItems(3000, 'm', rng(83)), align: 'start' })
    const [landed] = await Promise.all([
      d.animateToKey('m2500', { duration: 1000 }),
      (async () => {
        await d.frames(6)
        await d.dispatch('wheel')
      })(),
    ])
    expect(landed).toBe(false)
    const at = await d.scrollTop()
    expect(at).toBeGreaterThan(0)
    await d.frames(5)
    expect(Math.abs((await d.scrollTop()) - at)).toBeLessThanOrEqual(1)
    expect(await d.isMounted('m2500')).toBe(false)
  })

  test('jumps without animating when the user prefers reduced motion', async ({ d, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await d.mount({ items: makeItems(3000, 'm', rng(84)), align: 'start' })
    await d.startSampler(['scrollTop'])
    expect(await d.animateToKey('m2000', { duration: 1000 })).toBe(true)
    await d.frames(3)
    const samples = (await d.stopSampler()).map((s) => s[0]!)
    // No intermediate positions: only the final one.
    expect(new Set(samples.map((s) => Math.round(s))).size).toBeLessThanOrEqual(2)
    expect(Math.abs((await d.rowRect('m2000')).top)).toBeLessThanOrEqual(1)
  })
})
