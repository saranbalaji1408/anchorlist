import { defineConfig, type UserConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const config: UserConfig = defineConfig({
  entry: ['src/index.ts', 'src/sticky.ts', 'src/snapshot.ts', 'src/animate.ts', 'src/ssr.ts', 'src/window.ts', 'src/rtl.ts', 'src/lanes.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2020',
  dts: true,
  clean: true,
  sourcemap: true,
  // VERSION tracks package.json, which Changesets bumps on release.
  define: { __VERSION__: JSON.stringify(pkg.version) },
  // Stable chunk names, so size budgets can measure an entry without the shared scroller chunk.
  hash: false,
})

export default config
