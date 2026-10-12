import { expect, test, type Page } from '@playwright/test'
import { BROWSER_NOTICE } from '../src/harness'

const watchErrors = (page: Page): string[] => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !BROWSER_NOTICE.test(m.text())) errors.push(m.text())
  })
  return errors
}

/**
 * The examples render real text, so row sizes are fractional while browsers
 * store `scrollTop` in whole pixels at DPR 1 (WebKit truncates). A correction
 * can therefore be off by up to 1 px here; the synthetic scenarios use whole
 * pixel sizes and assert 0.5 px.
 */
const TEXT_TOLERANCE = 1

const probe = (page: Page) => ({
  distanceToEnd: () => page.locator('#scroller').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
  scrollHeight: () => page.locator('#scroller').evaluate((el) => el.scrollHeight),
  setScrollTop: (v: number) => page.locator('#scroller').evaluate((el, v) => void (el.scrollTop = v), v),
  /** Key and top of the first row ending below `y` px from the viewport top (rows have gaps). */
  rowAt: (y: number) =>
    page.locator('#scroller').evaluate((el, y) => {
      const t = el.getBoundingClientRect().top + y
      const row = Array.from(el.querySelectorAll<HTMLElement>('[data-key]')).find((r) => {
        return r.getBoundingClientRect().bottom > t
      })
      return row ? { key: row.dataset.key!, top: row.getBoundingClientRect().top } : null
    }, y),
  topOf: (key: string) => page.locator(`#scroller [data-key="${key}"]`).evaluate((el) => el.getBoundingClientRect().top),
})

test.describe('README examples', () => {
  test('chat: opens at the newest message, loads older pages without a jump, follows own messages', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('./?example=chat')
    const p = probe(page)
    await expect(page.locator('#scroller [data-key]').first()).toBeVisible()
    expect(await p.distanceToEnd()).toBeLessThanOrEqual(1)

    // Scroll to the top: an older page is prepended and the row being read stays put.
    // Scroll and read the row in one step in the page, two frames later: well before the fake
    // page load lands (300 ms). Polling from the test could read it after the prepend, and then
    // neither the prepend nor the position check would be observed.
    const read = await page.locator('#scroller').evaluate(async (el) => {
      el.scrollTop = 0
      for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r))
      const t = el.getBoundingClientRect().top + 200
      const row = Array.from(el.querySelectorAll<HTMLElement>('[data-key]')).find((r) => r.getBoundingClientRect().bottom > t)!
      return { key: row.dataset.key!, top: row.getBoundingClientRect().top, index: Number(row.dataset.index), origin: el.getBoundingClientRect().top }
    })
    expect(read.top - read.origin).toBeLessThan(500)
    // The older page (20 messages) lands above it: its index moves by 20, its position does not.
    const indexOf = (key: string): Promise<number> => page.locator(`#scroller [data-key="${key}"]`).evaluate((el) => Number((el as HTMLElement).dataset.index))
    await expect.poll(() => indexOf(read.key)).toBe(read.index + 20)
    await page.waitForTimeout(50)
    expect(Math.abs((await p.topOf(read.key)) - read.top)).toBeLessThanOrEqual(TEXT_TOLERANCE)

    // A received message is not followed while scrolled up; a sent one is.
    await page.getByRole('button', { name: 'Receive' }).click()
    await page.waitForTimeout(50)
    expect(Math.abs((await p.topOf(read.key)) - read.top)).toBeLessThanOrEqual(TEXT_TOLERANCE)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect.poll(p.distanceToEnd).toBeLessThanOrEqual(1)
    await expect(page.locator('#scroller [data-key]').last()).toHaveText('a new message from me')
    expect(errors).toEqual([])
  })

  test('feed: opens at the top and appends pages near the end', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('./?example=feed')
    const p = probe(page)
    await expect(page.locator('#scroller [data-key]').first()).toBeVisible()
    expect(await page.locator('#scroller').evaluate((el) => el.scrollTop)).toBe(0)
    const height = await p.scrollHeight()
    await p.setScrollTop(1e6)
    await expect.poll(p.scrollHeight).toBeGreaterThan(height)
    const read = (await p.rowAt(200))!
    await page.waitForTimeout(50)
    expect(Math.abs((await p.topOf(read.key)) - read.top)).toBeLessThanOrEqual(TEXT_TOLERANCE)
    expect(errors).toEqual([])
  })
})
