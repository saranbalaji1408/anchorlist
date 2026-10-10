/**
 * Tree-shaking check: importing the list entry (`createVirtualizer` +
 * `elementScroller`) must not pull in any optional subpath entry of
 * `@anchorlist/core` (lanes, window, rtl, animate, ...).
 *
 * It bundles the list import twice with rolldown (the bundler tsdown uses):
 * - from the sources, where every module keeps its identity, so code that
 *   moved into a shared module would still be attributed to its source file;
 * - from the built `dist`, as published.
 * Optional entries are found by name in the package's `exports`, so an entry
 * that does not exist on a branch is simply not checked. Run after `pnpm build`.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const core = join(root, 'packages/core')
// rolldown is a dependency of tsdown, not of the workspace root.
const require = createRequire(createRequire(join(root, 'package.json')).resolve('tsdown/package.json'))

/** The part of rolldown's API used here (its types are not resolvable from the root). */
interface Plugin {
  name: string
  resolveId(id: string): string | null
  load(id: string): string | null
}
interface Output {
  type: 'chunk' | 'asset'
  modules: Record<string, { renderedLength: number }>
}
interface Bundle {
  generate(o: { format: 'esm' }): Promise<{ output: Output[] }>
  close(): Promise<void>
}
const { rolldown } = (await import(require.resolve('rolldown'))) as {
  rolldown(o: { input: string; logLevel: 'silent'; plugins: Plugin[] }): Promise<Bundle>
}

const pkg = JSON.parse(readFileSync(join(core, 'package.json'), 'utf8')) as { exports: Record<string, unknown> }
const optional = Object.keys(pkg.exports)
  .filter((k) => k.startsWith('./') && k !== './package.json')
  .map((k) => k.slice(2))

async function included(entry: string): Promise<string[]> {
  const virtual = '\0list-entry'
  const bundle = await rolldown({
    input: virtual,
    logLevel: 'silent',
    plugins: [
      {
        name: 'list-entry',
        resolveId: (id) => (id === virtual ? id : null),
        load: (id) =>
          id === virtual ? `import { createVirtualizer, elementScroller } from ${JSON.stringify(entry)}\nconsole.log(createVirtualizer, elementScroller)` : null,
      },
    ],
  })
  const { output } = await bundle.generate({ format: 'esm' })
  await bundle.close()
  // Modules that contributed code after tree-shaking.
  return output.flatMap((chunk) =>
    chunk.type === 'chunk' ? Object.entries(chunk.modules).filter(([, m]) => m.renderedLength > 0).map(([id]) => id) : [],
  )
}

const failures: string[] = []
const check = (label: string, ids: string[], file: (name: string) => string): void => {
  for (const name of optional) {
    const hit = ids.find((id) => id.replace(/\\/g, '/').endsWith(file(name)))
    if (hit) failures.push(`${label}: the list import includes the "${name}" entry (${hit})`)
  }
}

check('src', await included(join(core, 'src/index.ts')), (name) => `/packages/core/src/${name}.ts`)
check('dist', await included(join(core, 'dist/index.js')), (name) => `/packages/core/dist/${name}.js`)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`tree-shaking: the list import excludes ${optional.map((n) => `/${n}`).join(', ')}`)
