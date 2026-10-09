import { makeItems, rng } from '../src/data'
import { expect, still, test } from '../src/harness'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

test.describe('touch WebKit (iOS)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((ua) => Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua }), IPHONE)
  })

  test('defers corrections into a transform on the content wrapper while touching and commits them without a jump', async ({ d }) => {
    const random = rng(23)
    const items = makeItems(60, 'm', random)
    await d.mount({ items, header: 40, footer: 40 })
    await d.scrollBy(-2000)
    const anchor = await d.rowAt(300)
    const scrollTopBefore = await d.scrollTop()
    await still(d, [`top:${anchor}`], async () => {
      await d.dispatch('touchstart')
      await d.frames(1)
      await d.update({ items: [...makeItems(20, 'p', random), ...items], header: 90 })
      // scrollTop is untouched during the gesture; the correction lives in a transform
      // on the wrapper, so header, rows and footer move together.
      expect(await d.scrollTop()).toBe(scrollTopBefore)
      expect(await d.contentTransform()).toMatch(/translateY/)
      await d.frames(3)
      await d.dispatch('touchend')
      await d.wait(200)
      await d.frames(2)
    })
    expect(await d.contentTransform()).toBe('')
    expect(await d.scrollTop()).toBeGreaterThan(scrollTopBefore)
  })
})
