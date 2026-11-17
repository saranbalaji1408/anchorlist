import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Scenarios run against a development build (`vite build --mode development`)
// so React StrictMode double-invokes renders and effects, and React warnings
// reach the console where scenarios fail on them.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: mode === 'development' ? { 'process.env.NODE_ENV': '"development"' } : {},
  build: mode === 'development' ? { minify: false } : {},
}))
