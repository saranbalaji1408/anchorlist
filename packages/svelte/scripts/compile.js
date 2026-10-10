// Compiles the packaged components and rune modules in `dist` to plain
// JavaScript in `dist/.size`, so size-limit measures what an app ships.
// `dist/.size` is not published.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile, compileModule } from 'svelte/compiler'

const dist = new URL('../dist/', import.meta.url).pathname
const out = join(dist, '.size')
mkdirSync(out, { recursive: true })
const relink = (code) => code.replace(/(from\s+['"]\.\/[^'"]+)\.svelte(['"])/g, '$1.svelte.js$2')

for (const file of readdirSync(dist)) {
  if (file.startsWith('.')) continue
  const source = readFileSync(join(dist, file), 'utf8')
  if (file.endsWith('.svelte')) {
    writeFileSync(join(out, `${file}.js`), relink(compile(source, { filename: file, generate: 'client' }).js.code))
  } else if (file.endsWith('.svelte.js')) {
    writeFileSync(join(out, file), relink(compileModule(source, { filename: file, generate: 'client' }).js.code))
  } else if (file.endsWith('.js')) {
    writeFileSync(join(out, file), relink(source))
  }
}
