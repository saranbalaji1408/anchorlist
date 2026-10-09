import { expect, test } from '@playwright/test'

test('fixture page loads and exposes the driver', async ({ page }) => {
  await page.goto('/')
  const hasDriver = await page.evaluate(() => typeof window.__driver?.mount === 'function')
  expect(hasDriver).toBe(true)
})
