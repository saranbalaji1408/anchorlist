import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type { Alias } from 'vite'

const require = createRequire(import.meta.url)
const dir = (name: string): string => dirname(require.resolve(`${name}/package.json`))

/**
 * Aliases that send every `react` and `react-dom` import (the fixture, the
 * built anchorlist packages and the unit tests) to this package's React 18.
 * `server` maps to the Node build for the unit tests.
 */
export function react18Aliases(): Alias[] {
  const react = dir('react')
  const reactDom = dir('react-dom')
  return [
    { find: /^react$/, replacement: `${react}/index.js` },
    { find: /^react\/(.+)$/, replacement: `${react}/$1.js` },
    { find: /^react-dom$/, replacement: `${reactDom}/index.js` },
    { find: /^react-dom\/server$/, replacement: `${reactDom}/server.node.js` },
    { find: /^react-dom\/(.+)$/, replacement: `${reactDom}/$1.js` },
  ]
}
