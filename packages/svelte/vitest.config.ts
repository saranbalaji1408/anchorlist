import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject } from 'vitest/config'

// Svelte adapter tests: components and rune modules are compiled by the Svelte
// plugin and run against the client runtime in happy-dom.
export default defineProject({
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  test: {
    name: 'svelte',
    environment: 'happy-dom',
    include: ['src/**/*.test.svelte.ts'],
  },
})
