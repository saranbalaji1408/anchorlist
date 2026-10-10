import { defineConfig, type UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: ['src/index.ts', 'src/sticky.ts', 'src/animate.ts', 'src/snapshot.ts', 'src/ssr.ts', 'src/window.ts', 'src/rtl.ts'],
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
