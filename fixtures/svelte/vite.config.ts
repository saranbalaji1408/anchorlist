import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// Builds into `fixtures/react/dist/svelte`, served by the React fixture's
// preview server at `/svelte/`. Build it after the React 19 fixture, which
// empties `dist`. Scenarios run against a development build, so Svelte
// warnings reach the console, where scenarios fail on them.
export default defineConfig(({ mode }) => ({
  base: '/svelte/',
  plugins: [svelte({ compilerOptions: { dev: mode === 'development' } })],
  define: mode === 'development' ? { 'process.env.NODE_ENV': '"development"' } : {},
  build: {
    outDir: fileURLToPath(new URL('../react/dist/svelte', import.meta.url)),
    emptyOutDir: true,
    ...(mode === 'development' ? { minify: false } : {}),
  },
}))
