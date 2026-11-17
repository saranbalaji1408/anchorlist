import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)
const dir = dirname(require.resolve('svelte/package.json'))
const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')) as { version: string; exports: Record<string, unknown> }

/** The browser build of an export condition tree. */
const pick = (e: unknown): string | null => {
  if (typeof e === 'string') return e
  if (!e) return null
  const c = (e ?? {}) as Record<string, unknown>
  return pick(c.browser ?? c.default ?? c.import ?? null)
}
// Every `svelte` and `svelte/*` import (the adapter source and the tests) goes to this package's Svelte.
const alias = Object.entries(pkg.exports)
  .filter(([k]) => !k.includes('*') && k !== './package.json')
  .flatMap(([k, e]) => {
    const file = pick(e)
    return file ? [{ find: new RegExp(`^svelte${k.slice(1).replace(/[/.]/g, '\\$&')}$`), replacement: `${dir}/${file.slice(2)}` }] : []
  })

// The @anchorlist/svelte unit tests, run against the oldest supported Svelte 5
// (`pnpm test:svelte-floor`), compiled by the plugin release for that Svelte.
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [svelte({ configFile: false })],
  resolve: { conditions: ['browser'], alias },
  test: {
    env: { EXPECT_SVELTE_VERSION: pkg.version },
    name: 'svelte-floor',
    environment: 'happy-dom',
    include: ['packages/svelte/src/**/*.test.svelte.ts'],
  },
})
