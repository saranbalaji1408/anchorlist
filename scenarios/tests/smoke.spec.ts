import { expect, test } from '@playwright/test'

test('fixture page loads, exposes the driver and runs the expected React major', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__driver?.mount === 'function')
  const version = await page.evaluate(() => window.__driver.frameworkVersion())
  const expected = test.info().project.name.endsWith('-react18') ? '18' : '19'
  expect(version.split('.')[0]).toBe(expected)
})
