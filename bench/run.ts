/**
 * Head-to-head runner: serves the production build in `dist/`, drives each
 * library through the same chat scenarios in Chromium, Firefox and WebKit,
 * and writes `results/results.json`. See README.md for the methodology.
 *
 *   pnpm bench            # build everything, then run
 *   RUNS=5 node run.ts    # more runs per scenario (default 3)
 *   BROWSERS=chromium node run.ts
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { cpus, loadavg } from 'node:os'
import { extname, join } from 'node:path'
import { chromium, firefox, webkit, type Browser, type Page } from '@playwright/test'
import type { Bench } from './src/main.tsx'

const ROOT = import.meta.dirname
const RUNS = Number(process.env.RUNS ?? 3)
const LIBS = ['anchorlist', 'tanstack', 'virtuoso'] as const
const ENGINES = { chromium, firefox, webkit }
const BROWSERS = (process.env.BROWSERS ?? 'chromium,firefox,webkit').split(',') as Array<keyof typeof ENGINES>
const COUNT = 10_000
const PORT = Number(process.env.BENCH_PORT ?? 4193)

type Lib = (typeof LIBS)[number]
/** Per-run metrics of one scenario. */
type Metrics = Record<string, number>

// ------------------------------------------------------------------ server

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer((req, res) => {
  const path = new URL(req.url!, 'http://x').pathname
  try {
    const body = readFileSync(join(ROOT, 'dist', path === '/' ? 'index.html' : path))
    res.writeHead(200, { 'content-type': TYPES[extname(path) || '.html'] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise<void>((r) => server.listen(PORT, r))

// ------------------------------------------------------------------ helpers

/** Calls a `window.__bench` method in the page. */
function call<K extends keyof Bench>(page: Page, name: K, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(([n, a]) => (window.__bench[n as keyof Bench] as (...x: unknown[]) => unknown).apply(window.__bench, a as unknown[]), [name, args] as const)
}
const num = async (p: Promise<unknown>): Promise<number> => (await p) as number
const rect = async (page: Page, id: string): Promise<{ top: number; bottom: number } | null> =>
  (await call(page, 'rect', id)) as { top: number; bottom: number } | null

async function open(browser: Browser, lib: Lib, memo: boolean): Promise<Page> {
  // Firefox occasionally reports a page's navigation as interrupted by a navigation to the same
  // URL: retry on a fresh page.
  for (let attempt = 0; ; attempt++) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
    try {
      await page.goto(`http://localhost:${PORT}/?lib=${lib}${memo ? '&memo' : ''}`, { waitUntil: 'commit' })
      await page.waitForFunction(() => typeof window.__bench?.mount === 'function')
      return page
    } catch (e) {
      await page.close()
      if (attempt >= 2) throw e
    }
  }
}

/** First mounted row whose top is at or below `at` px. */
async function rowFrom(page: Page, at: number): Promise<string> {
  for (const key of (await call(page, 'keys')) as string[]) if (((await rect(page, key))?.top ?? -Infinity) >= at) return key
  throw new Error(`no row from ${at}`)
}

const quantile = (a: number[], q: number): number => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))]! : Number.NaN
}
const round = (x: number, d = 2): number => Math.round(x * 10 ** d) / 10 ** d

/** Drift statistics of anchor samples against `base`; NaN samples (anchor unmounted) count as lost frames. */
function drift(samples: number[], base: number): Metrics {
  const dev = samples.filter((s) => !Number.isNaN(s)).map((s) => Math.abs(s - base))
  return { driftMax: round(Math.max(0, ...dev)), driftP95: round(quantile(dev, 0.95)), lostFrames: samples.length - dev.length, frames: samples.length }
}

// ------------------------------------------------------------------ scenarios

/**
 * Prepend: scrolled 3000 px up from the bottom, 10 pages of 50 unmeasured
 * items are prepended (5 frames apart) while a row in the viewport is read.
 */
async function prepend(page: Page, seed: number): Promise<Metrics> {
  const mountMs = await num(call(page, 'mount', COUNT, seed))
  await call(page, 'scrollBy', -3000)
  await call(page, 'frames', 20)
  const anchor = await rowFrom(page, 200)
  const base = (await rect(page, anchor))!.top
  await call(page, 'startSampler', anchor)
  await call(page, 'frames', 1)
  const costs: number[] = []
  let rerenders = 0
  for (let i = 0; i < 10; i++) {
    const mounted = new Set((await call(page, 'keys')) as string[])
    await call(page, 'takeRenders')
    costs.push(await num(call(page, 'prepend', 50)))
    await call(page, 'frames', 5)
    const r = (await call(page, 'takeRenders')) as Record<string, number>
    for (const [id, n] of Object.entries(r)) if (mounted.has(id)) rerenders += n
  }
  await call(page, 'frames', 10)
  const samples = (await call(page, 'stopSampler')) as number[]
  const end = (await rect(page, anchor))?.top
  return {
    settleMs: round(mountMs),
    ...drift(samples, base),
    finalOffset: end === undefined ? Number.NaN : round(Math.abs(end - base)),
    updateMsP50: round(quantile(costs, 0.5)),
    updateMsMax: round(Math.max(...costs)),
    rerendersPerPrepend: round(rerenders / 10, 1),
  }
}

/**
 * Resize above: the last mounted row entirely above the viewport grows by
 * 80 px, 5 times, while a row in the viewport is read. Null when the list
 * keeps no row above the viewport mounted (its default overscan).
 */
async function growAbove(page: Page, seed: number): Promise<Metrics | null> {
  await call(page, 'mount', COUNT, seed)
  await call(page, 'scrollBy', -3000)
  await call(page, 'frames', 20)
  let above: string | undefined
  for (const key of (await call(page, 'keys')) as string[]) if (((await rect(page, key))?.bottom ?? 1) <= 0) above = key
  if (!above) return null
  const anchor = await rowFrom(page, 200)
  const base = (await rect(page, anchor))!.top
  await call(page, 'startSampler', anchor)
  await call(page, 'frames', 1)
  for (let i = 0; i < 5; i++) {
    await call(page, 'grow', above, 80)
    await call(page, 'frames', 5)
  }
  await call(page, 'frames', 5)
  return drift((await call(page, 'stopSampler')) as number[], base)
}

/**
 * Follow: pinned at the bottom, 20 single-item appends `gap` frames apart (3
 * for a fast stream, 10 for messages); the distance from the bottom just
 * before the next append.
 */
async function follow(page: Page, seed: number, gap: number): Promise<Metrics> {
  await call(page, 'mount', COUNT, seed)
  let max = 0
  let unpinned = 0
  for (let i = 0; i < 20; i++) {
    await call(page, 'append', 1)
    await call(page, 'frames', gap)
    const d = await num(call(page, 'fromBottom'))
    max = Math.max(max, d)
    if (d > 1) unpinned++
  }
  return { fromBottomMax: round(max), unpinnedAppends: unpinned }
}

/**
 * Scroll: 300 frames scrolling up 120 px per frame (a fast flick) through
 * unmeasured rows (Chromium only). Main-thread time comes from the DevTools
 * protocol's Performance metrics, so work in any task counts, not only work
 * inside the frame.
 */
async function scroll(page: Page, seed: number, browser: string): Promise<Metrics | null> {
  if (browser !== 'chromium') return null
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await call(page, 'mount', COUNT, seed)
  const metrics = async (): Promise<Record<string, number>> =>
    Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  const before = await metrics()
  const t = (await call(page, 'scrollFrames', -120, 300)) as number[]
  const after = await metrics()
  const perFrame = (k: string): number => round(((after[k]! - before[k]!) * 1000) / t.length, 3)
  return {
    taskMsPerFrame: perFrame('TaskDuration'),
    scriptMsPerFrame: perFrame('ScriptDuration'),
    layoutMsPerFrame: perFrame('LayoutDuration'),
    frameMsP95: round(quantile(t, 0.95)),
    longFrames: t.filter((x) => x > 25).length,
  }
}

/** Prepend again with the row content wrapped in `React.memo`: only the re-render count is kept. */
async function prependMemo(page: Page, seed: number): Promise<Metrics> {
  return { rerendersPerPrepend: (await prepend(page, seed)).rerendersPerPrepend! }
}

/** Scenario functions; `memo` pages wrap the row content in `React.memo`. */
const SCENARIOS: Record<string, { fn: (page: Page, seed: number, browser: string) => Promise<Metrics | null>; memo?: boolean }> = {
  prepend: { fn: prepend },
  prependMemo: { fn: prependMemo, memo: true },
  growAbove: { fn: growAbove },
  followFast: { fn: (page, seed) => follow(page, seed, 3) },
  followSlow: { fn: (page, seed) => follow(page, seed, 10) },
  scroll: { fn: scroll },
}

// ------------------------------------------------------------------ run

/** Median of each metric over the runs (max for worst-case metrics), plus the raw runs. */
function summarise(runs: Metrics[]): { median: Metrics; worst: Metrics; runs: Metrics[] } {
  const median: Metrics = {}
  const worst: Metrics = {}
  for (const k of Object.keys(runs[0] ?? {})) {
    const v = runs.map((r) => r[k]!)
    median[k] = round(quantile(v, 0.5))
    worst[k] = round(Math.max(...v))
  }
  return { median, worst, runs }
}

const versions = (): Record<string, string> => {
  const v = (p: string): string => (JSON.parse(readFileSync(join(ROOT, 'node_modules', p, 'package.json'), 'utf8')) as { version: string }).version
  const git = (...a: string[]): string => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim()
  return {
    anchorlist: `${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain', '--', '../packages').length ? ' (uncommitted changes)' : ''}`,
    '@tanstack/react-virtual': v('@tanstack/react-virtual'),
    'react-virtuoso': v('react-virtuoso'),
    react: v('react'),
  }
}

/** 1, 5 and 15 minute load averages: timings are only meaningful on a quiet machine. */
const startLoad = loadavg()
const results: Record<string, unknown> = {}
for (const name of BROWSERS) {
  const browser = await ENGINES[name].launch()
  const byScenario: Record<string, unknown> = {}
  for (const [scenario, { fn, memo = false }] of Object.entries(SCENARIOS)) {
    const byLib: Record<string, unknown> = {}
    for (const lib of LIBS) {
      const runs: Metrics[] = []
      for (let r = 0; r < RUNS; r++) {
        const page = await open(browser, lib, memo)
        const m = await fn(page, 100 + r, name)
        await page.close()
        if (m) runs.push(m)
      }
      // null: not applicable (see the scenario).
      byLib[lib] = runs.length ? summarise(runs) : null
      console.log(name, scenario, lib, runs.length ? JSON.stringify(summarise(runs).median) : 'n/a')
    }
    if (Object.values(byLib).some((x) => x)) byScenario[scenario] = byLib
  }
  results[name] = { version: browser.version(), scenarios: byScenario }
  await browser.close()
}
server.close()

const sizes = JSON.parse(execFileSync(join(ROOT, 'node_modules/.bin/size-limit'), ['--json'], { cwd: ROOT, encoding: 'utf8' })) as Array<{
  name: string
  size: number
}>

mkdirSync(join(ROOT, 'results'), { recursive: true })
const out = {
  date: new Date().toISOString(),
  machine: { cpu: cpus()[0]?.model, cores: cpus().length, platform: process.platform, loadBefore: startLoad, loadAfter: loadavg() },
  runs: RUNS,
  items: COUNT,
  versions: versions(),
  sizes: Object.fromEntries(sizes.map((s) => [s.name, s.size])),
  browsers: results,
}
writeFileSync(join(ROOT, 'results/results.json'), JSON.stringify(out, null, 2) + '\n')
console.log('sizes (min+gzip, react external):', out.sizes)
