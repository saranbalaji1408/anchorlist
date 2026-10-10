import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = !!process.env.CI
const BASE = `http://localhost:${PORT}/`
const browsers = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'webkit', device: devices['Desktop Safari'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
]

export default defineConfig({
  testDir: './scenarios/tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Retries must not hide flaky drift: a test that only passes on retry fails the run.
  failOnFlakyTests: isCI,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
  },
  // Every browser runs the fixture on React 19 (`/`) and on React 18 (`/react18/`).
  // Scenarios navigate with relative URLs (`./`), so they stay under the base path.
  projects: browsers.flatMap(({ name, device }) => [
    { name, use: { ...device, baseURL: BASE } },
    { name: `${name}-react18`, use: { ...device, baseURL: `${BASE}react18/` } },
  ]),
  webServer: {
    // Builds the packages, then development builds of the fixture for React 19
    // and React 18 (StrictMode checks and React warnings on), served together.
    command:
      'pnpm build && pnpm --filter @anchorlist/fixture-react build:dev && ' +
      `pnpm --filter @anchorlist/fixture-react18 build:dev && pnpm --filter @anchorlist/fixture-react preview --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
})
