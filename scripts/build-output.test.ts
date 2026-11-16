import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Checks the built packages (`pnpm build` runs before `pnpm test`). React
// Server Components treat a module as a client module only when 'use client'
// is its first statement. Every chunk of the React packages needs it; the core
// is framework-agnostic and must stay importable from server code without it.
const root = fileURLToPath(new URL('..', import.meta.url))
const DIRECTIVE = /^(['"])use client\1;?(\r?\n|$)/

/** Every JS file a package ships: its export targets and every chunk in dist. */
const builtFiles = (pkg: string): string[] => {
  const dir = join(root, 'packages', pkg)
  const dist = join(dir, 'dist')
  if (!existsSync(dist)) throw new Error(`packages/${pkg}/dist is missing: run pnpm build first`)
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { exports: Record<string, unknown> }
  const targets = new Set<string>()
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (v.endsWith('.js')) targets.add(join(dir, v))
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(manifest.exports)
  for (const f of readdirSync(dist)) if (f.endsWith('.js')) targets.add(join(dist, f))
  return [...targets].sort()
}

const startsWithDirective = (file: string): boolean => existsSync(file) && DIRECTIVE.test(readFileSync(file, 'utf8'))

describe("'use client' directive in built output", () => {
  for (const pkg of ['react', 'anchorlist']) {
    it(`starts every JS entry and chunk of ${pkg}`, () => {
      const files = builtFiles(pkg)
      expect(files.length).toBeGreaterThan(0)
      expect(files.filter((f) => !startsWithDirective(f)).map((f) => f.slice(root.length))).toEqual([])
    })
  }

  it('is absent from every JS entry and chunk of core', () => {
    const files = builtFiles('core')
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((f) => readFileSync(f, 'utf8').includes('use client')).map((f) => f.slice(root.length))).toEqual([])
  })
})
