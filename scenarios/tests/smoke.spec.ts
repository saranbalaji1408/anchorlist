import { expect, test } from '@playwright/test'

test('fixture page loads and exposes the driver bridge', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'anchorlist fixture' })).toBeVisible()
  const hasDriver = await page.evaluate(() => typeof (window as unknown as { __driver?: unknown }).__driver === 'object')
  expect(hasDriver).toBe(true)
})
