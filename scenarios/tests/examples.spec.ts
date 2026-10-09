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
  /** Key and top of the row at `y` px below the viewport top. */
  rowAt: (y: number) =>
    page.locator('#scroller').evaluate((el, y) => {
      const t = el.getBoundingClientRect().top + y
      const row = Array.from(el.querySelectorAll<HTMLElement>('[data-key]')).find((r) => {
        const b = r.getBoundingClientRect()
        return b.top <= t && b.bottom > t
      })
      return row ? { key: row.dataset.key!, top: row.getBoundingClientRect().top } : null
    }, y),
  topOf: (key: string) => page.locator(`#scroller [data-key="${key}"]`).evaluate((el) => el.getBoundingClientRect().top),
})

test.describe('README examples', () => {
  test('chat: opens at the newest message, loads older pages without a jump, follows own messages', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/?example=chat')
    const p = probe(page)
    await expect(page.locator('#scroller [data-key]').first()).toBeVisible()
    expect(await p.distanceToEnd()).toBeLessThanOrEqual(1)

    // Scroll to the top: an older page is prepended and the row being read stays put.
    await p.setScrollTop(0)
    await page.waitForTimeout(30)
    const read = (await p.rowAt(200))!
    const height = await p.scrollHeight()
    await expect.poll(p.scrollHeight).toBeGreaterThan(height)
    await page.waitForTimeout(100)
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
    await page.goto('/?example=feed')
    const p = probe(page)
    await expect(page.locator('#scroller [data-key]').first()).toBeVisible()
    expect(await page.locator('#scroller').evaluate((el) => el.scrollTop)).toBe(0)
    const height = await p.scrollHeight()
    await p.setScrollTop(1e6)
    await expect.poll(p.scrollHeight).toBeGreaterThan(height)
    const read = (await p.rowAt(200))!
    await page.waitForTimeout(100)
    expect(Math.abs((await p.topOf(read.key)) - read.top)).toBeLessThanOrEqual(TEXT_TOLERANCE)
    expect(errors).toEqual([])
  })
})
