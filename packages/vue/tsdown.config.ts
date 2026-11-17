import { defineConfig, type UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: ['src/index.ts', 'src/sticky.ts', 'src/horizontal.ts', 'src/lanes.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2020',
  dts: true,
  clean: true,
  sourcemap: true,
  // Stable chunk names, so the lanes budget can measure its entry without the shared list chunk.
  hash: false,
})

export default config
