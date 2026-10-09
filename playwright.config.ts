import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './scenarios/tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    // Builds the packages, then a development build of the fixture (StrictMode checks and React warnings on).
    command: `pnpm build && pnpm --filter @anchorlist/fixture-react build:dev && pnpm --filter @anchorlist/fixture-react preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
