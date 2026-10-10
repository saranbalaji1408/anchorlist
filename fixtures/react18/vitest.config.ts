import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { react18Aliases } from './react18.ts'

// The @anchorlist/react unit tests, run against React 18 (`pnpm test:react18`).
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: { alias: react18Aliases() },
  test: {
    env: { EXPECT_REACT_MAJOR: '18' },
    projects: [
      { extends: true, test: { name: 'react18-node', environment: 'node', include: ['packages/react/src/**/*.test.ts'] } },
      { extends: true, test: { name: 'react18-dom', environment: 'happy-dom', include: ['packages/react/src/**/*.dom.test.tsx'] } },
    ],
  },
})
