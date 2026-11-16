import { defineConfig, type UserConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const config: UserConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2020',
  dts: true,
  clean: true,
  sourcemap: true,
  // VERSION tracks package.json, which Changesets bumps on release.
  define: { __VERSION__: JSON.stringify(pkg.version) },
})

export default config
