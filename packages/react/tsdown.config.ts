import { defineConfig, type UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: ['src/index.ts', 'src/sticky.tsx', 'src/horizontal.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2020',
  dts: true,
  clean: true,
  sourcemap: true,
  // React Server Components: every entry is a client module. A banner keeps the
  // directive the first statement of each built chunk (bundlers drop it from source).
  banner: { js: "'use client'" },
})

export default config
