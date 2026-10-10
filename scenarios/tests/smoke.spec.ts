import { expect, test } from '@playwright/test'

test('fixture page loads, exposes the driver and runs the expected framework major', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__driver?.mount === 'function')
  const version = await page.evaluate(() => window.__driver.frameworkVersion())
  const project = test.info().project.name
  const expected = project.endsWith('-vue') ? '3' : project.endsWith('-react18') ? '18' : '19'
  expect(version.split('.')[0]).toBe(expected)
})
