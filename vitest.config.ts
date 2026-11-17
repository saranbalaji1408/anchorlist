import { defineConfig } from 'vitest/config'
import core from './packages/core/package.json' with { type: 'json' }

export default defineConfig({
  // Same injection as packages/core/tsdown.config.ts, for tests that import the core source.
  define: { __VERSION__: JSON.stringify(core.version) },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        // React adapter tests in a DOM (happy-dom has no layout; the tests mock it).
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['packages/*/src/**/*.dom.test.tsx'],
        },
      },
    ],
  },
})
