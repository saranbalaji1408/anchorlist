import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// Builds into `fixtures/react/dist/svelte`, served by the React fixture's
// preview server at `/svelte/`. Build it after the React 19 fixture, which
// empties `dist`. Scenarios run against a development build, so Svelte
// warnings reach the console, where scenarios fail on them.
//
// The server build (`--ssr src/ssr.ts`) compiles the app for the server into
// `ssr/`, self-contained, so the driver can server-render it in the page.
export default defineConfig(({ mode, isSsrBuild }) => ({
  base: '/svelte/',
  plugins: [svelte({ compilerOptions: { dev: mode === 'development' } })],
  define: mode === 'development' ? { 'process.env.NODE_ENV': '"development"' } : {},
  ...(isSsrBuild ? { ssr: { noExternal: true, target: 'webworker' as const } } : {}),
  build: {
    outDir: fileURLToPath(new URL(isSsrBuild ? '../react/dist/svelte/ssr' : '../react/dist/svelte', import.meta.url)),
    emptyOutDir: true,
    ...(mode === 'development' ? { minify: false } : {}),
    ...(isSsrBuild ? { rollupOptions: { output: { entryFileNames: 'ssr.js' } } } : {}),
  },
}))
