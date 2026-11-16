import { expectFramework, test } from '../src/harness'

test('fixture page loads, exposes the driver and runs the expected framework major', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__driver?.mount === 'function')
  await expectFramework(page)
})
