import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { react18Aliases } from './react18.ts'

// Builds the React fixture (`fixtures/react`) against React 18 into
// `fixtures/react/dist/react18`, served by the same preview server at `/react18/`.
// Build it after the React 19 fixture, which empties `dist`.
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('../react', import.meta.url)),
  base: '/react18/',
  plugins: [react()],
  resolve: { alias: react18Aliases() },
  define: mode === 'development' ? { 'process.env.NODE_ENV': '"development"' } : {},
  build: {
    outDir: fileURLToPath(new URL('../react/dist/react18', import.meta.url)),
    emptyOutDir: true,
    ...(mode === 'development' ? { minify: false } : {}),
  },
}))
