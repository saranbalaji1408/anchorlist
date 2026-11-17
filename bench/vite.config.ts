import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Production build: every library is measured as an app would ship it.
export default defineConfig({
  plugins: [react()],
  base: './',
})
