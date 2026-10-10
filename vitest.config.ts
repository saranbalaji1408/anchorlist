import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts'],
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
