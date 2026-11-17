import { describe, expect, it } from 'vitest'

// Node's fs, without depending on Node types in this package.
const { readFileSync } = (await import('node:fs' as string)) as { readFileSync(path: URL, encoding: 'utf8'): string }
const source = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8')
const imports = (file: string): string[] => [...source(file).matchAll(/from '(\.[^']+)'/g)].map((m) => m[1]!)

// A cheap import lint; the list-entry size-limit budget is the real tree-shaking guard.
describe('entries (imports)', () => {
  it('keeps the opt-in entries out of the main entry and the list engine', () => {
    for (const file of ['./index.ts', './virtualizer.ts', './scroller.ts', './adapter.ts'])
      for (const entry of ['./animate', './sticky', './snapshot', './ssr']) expect(imports(file), `${file} imports ${entry}`).not.toContain(entry)
  })

  it('gives the opt-in entries no runtime imports, so the build shares no chunk with the main entry', () => {
    for (const file of ['./animate.ts', './sticky.ts', './snapshot.ts', './ssr.ts'])
      expect(source(file).match(/^import (?!type )/gm), file).toBeNull()
  })
})
