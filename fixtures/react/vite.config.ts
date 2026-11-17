import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Scenarios run against a development build (`vite build --mode development`)
// so React StrictMode double-invokes renders and effects, and React warnings
// reach the console where scenarios fail on them.
//
// `mpa`: the preview server answers a path with no built `index.html` (an
// unbuilt `/vue-prod/`, say) with 404 instead of falling back to this app.
export default defineConfig(({ mode }) => ({
  appType: 'mpa',
  plugins: [react()],
  define: mode === 'development' ? { 'process.env.NODE_ENV': '"development"' } : {},
  build: mode === 'development' ? { minify: false } : {},
}))
