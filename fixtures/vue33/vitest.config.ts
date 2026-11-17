import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)
const vue = dirname(require.resolve('vue/package.json'))

// The @anchorlist/vue unit tests, run against Vue 3.3 (`pnpm test:vue33`).
// The adapter's synchronous path calls the `instance.update` internal, so the
// oldest supported minor is tested as well as the latest.
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: { alias: [{ find: /^vue$/, replacement: `${vue}/index.mjs` }] },
  test: {
    env: { EXPECT_VUE_MINOR: '3.3' },
    name: 'vue33',
    environment: 'happy-dom',
    include: ['packages/vue/src/**/*.dom.test.ts'],
  },
})
