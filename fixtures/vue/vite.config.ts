import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Builds into `fixtures/react/dist/vue`, served by the React fixture's preview
// server at `/vue/`. Build it after the React 19 fixture, which empties `dist`.
// Scenarios run against a development build, so Vue warnings reach the
// console, where scenarios fail on them.
export default defineConfig(({ mode }) => ({
  base: '/vue/',
  plugins: [vue()],
  define: mode === 'development' ? { 'process.env.NODE_ENV': '"development"' } : {},
  build: {
    outDir: fileURLToPath(new URL('../react/dist/vue', import.meta.url)),
    emptyOutDir: true,
    ...(mode === 'development' ? { minify: false } : {}),
  },
}))
