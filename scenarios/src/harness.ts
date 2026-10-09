import { appendFileSync, mkdirSync } from 'node:fs'
import { test as base, expect, type Page } from '@playwright/test'
import type { Probe } from './dom'
import type { Driver } from './driver'

/** Maximum allowed movement of an anchored row between painted frames, in px. */
export const TOLERANCE = 0.5

/** Every driver method, called in the page and awaited. */
export type RemoteDriver = {
  [K in keyof Driver]: Driver[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
}

/** A typed proxy that runs `window.__driver[name](...args)` in the page. */
export function remote(page: Page): RemoteDriver {
  return new Proxy({} as RemoteDriver, {
    get: (_, name: string) =>
      (...args: unknown[]) =>
        page.evaluate(
          ([n, a]) => (window.__driver as unknown as Record<string, (...x: unknown[]) => unknown>)[n as string]!(...(a as unknown[])),
          [name, args] as const,
        ),
  })
}

/** max - min of column `col`; Infinity with fewer than 3 frames or any failed read. */
export function spread(samples: number[][], col = 0): number {
  const values = samples.map((s) => s[col] ?? Number.NaN)
  return values.length < 3 || values.some(Number.isNaN) ? Number.POSITIVE_INFINITY : Math.max(...values) - Math.min(...values)
}

/** Firefox's generic notice for pages that write scroll offsets; not an error. */
export const BROWSER_NOTICE: RegExp = /scroll-linked positioning effect/

/**
 * The scenario fixtures: `d` is the driver of a freshly loaded fixture page.
 * Console errors and page errors (including React warnings) fail the test.
 */
export const test = base.extend<{ d: RemoteDriver }>({
  d: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if ((m.type() === 'error' || m.type() === 'warning') && !BROWSER_NOTICE.test(m.text())) errors.push(m.text())
    })
    await page.goto('/')
    await page.waitForFunction(() => typeof window.__driver?.mount === 'function')
    await use(remote(page))
    expect(errors, 'console errors').toEqual([])
  },
})

export { expect }

/**
 * Samples `probes` while `body` runs, then asserts that the first probe moved
 * by at most {@link TOLERANCE} across painted frames. Returns the samples.
 */
export async function still(d: RemoteDriver, probes: Probe[], body: () => Promise<unknown>, label = ''): Promise<number[][]> {
  await d.startSampler(probes)
  await d.frames(1)
  await body()
  const samples = await d.stopSampler()
  const drift = spread(samples)
  recordDrift(drift, label)
  expect(samples.length, `${label} frames sampled`).toBeGreaterThanOrEqual(3)
  expect(drift, `${label} drift`).toBeLessThanOrEqual(TOLERANCE)
  return samples
}

/** Appends a drift measurement to `test-results/drift.jsonl` (for the summary in the report). */
export function recordDrift(drift: number, label = ''): void {
  try {
    const info = test.info()
    mkdirSync('test-results', { recursive: true })
    appendFileSync(
      'test-results/drift.jsonl',
      JSON.stringify({ project: info.project.name, test: info.title, label, drift }) + '\n',
    )
  } catch {
    // Reporting only.
  }
}
