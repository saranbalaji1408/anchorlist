/**
 * Tree-shaking check: importing the list entry (`createVirtualizer` +
 * `elementScroller`) must not pull in any optional subpath entry of
 * `@anchorlist/core` (lanes, window, rtl, animate, ...), and importing
 * `AnchorList` must not pull in any optional entry of `@anchorlist/react`
 * (horizontal, lanes, ...).
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
  rolldown(o: { input: string; logLevel: 'silent'; external: RegExp; plugins: Plugin[] }): Promise<Bundle>
}

/** Optional entry names of a package, from its `exports` (everything but `.` and `./package.json`). */
const optionalEntries = (dir: string): string[] =>
  Object.keys((JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { exports: Record<string, unknown> }).exports)
    .filter((k) => k.startsWith('./') && k !== './package.json')
    .map((k) => k.slice(2))

/** Modules that contribute code when `names` are imported from `entry`; `external` ids are left out. */
async function included(entry: string, names: string, external: RegExp): Promise<string[]> {
  const virtual = '\0list-entry'
  const bundle = await rolldown({
    input: virtual,
    logLevel: 'silent',
    external,
    plugins: [
      {
        name: 'list-entry',
        resolveId: (id) => (id === virtual ? id : null),
        load: (id) => (id === virtual ? `import { ${names} } from ${JSON.stringify(entry)}\nconsole.log(${names})` : null),
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
const checked: string[] = []
/** Fails when importing `names` from a package pulls in any of its optional entries, from src and from dist. */
async function check(pkg: string, names: string, external: RegExp): Promise<void> {
  const dir = join(root, 'packages', pkg)
  const optional = optionalEntries(dir)
  for (const [label, entry, file] of [
    ['src', 'src/index.ts', (name: string) => new RegExp(`/packages/${pkg}/src/${name}\\.tsx?$`)],
    ['dist', 'dist/index.js', (name: string) => new RegExp(`/packages/${pkg}/dist/${name}\\.js$`)],
  ] as const) {
    const ids = (await included(join(dir, entry), names, external)).map((id) => id.replace(/\\/g, '/'))
    for (const name of optional) {
      const hit = ids.find((id) => file(name).test(id))
      if (hit) failures.push(`${pkg} ${label}: { ${names} } includes the "${name}" entry (${hit})`)
    }
  }
  checked.push(`{ ${names} } excludes ${optional.map((n) => `${pkg}/${n}`).join(', ')}`)
}

await check('core', 'createVirtualizer, elementScroller', /^$/)
// React and the core are peers or dependencies of the React package: only its own code is checked.
await check('react', 'AnchorList', /^(react|react-dom|@anchorlist\/core)(\/|$)/)
// Likewise for the Vue package.
await check('vue', 'AnchorList', /^(vue|@anchorlist\/core)(\/|$)/)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`tree-shaking: ${checked.join('; ')}`)
