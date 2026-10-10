import type { Page } from '@playwright/test'
import { expect, recordDrift, TOLERANCE } from './harness'

/**
 * Scroll layouts beyond the vertical scroll container. The fixture mounts them
 * with `layout` (and `scrollMargin` for `window`); the helpers here read the
 * DOM in the page along the layout's main axis, so scenarios stay
 * framework-neutral.
 */
export type Layout = 'vertical' | 'horizontal' | 'rtl' | 'window'

interface AxisProbe {
  /** Main-axis start of a mounted row relative to the viewport start (NaN when not mounted). */
  start(key: string): number
  /** Main-axis end of a mounted row relative to the viewport start. */
  end(key: string): number
  /** Normalised scroll offset: grows from the start edge in every layout. */
  offset(): number
  /** Largest normalised offset. */
  max(): number
  /** Viewport size along the main axis (below the scroll margin for `window`). */
  viewport(): number
  /** Moves the offset by `delta` like a user scroll. Returns the applied delta. */
  scrollBy(delta: number): number
  /** Keys of mounted rows in DOM order. */
  keys(): string[]
  startSampler(keys: string[]): void
  stopSampler(): number[][]
}

declare global {
  interface Window {
    __axis: AxisProbe
  }
}

/** Installs `window.__axis` for `layout`. Call after the page has loaded. */
export async function installAxis(page: Page, layout: Layout, margin = 0): Promise<void> {
  await page.evaluate(
    ([layout, margin]) => {
      const win = layout === 'window'
      const sc = (): HTMLElement => (win ? document.documentElement : document.getElementById('scroller')!)
      const row = (key: string): Element | null =>
        document.getElementById('scroller')?.querySelector(`[data-key="${CSS.escape(key)}"]`) ?? null
      const edges = (key: string): [number, number] => {
        const el = row(key)
        if (!el) return [Number.NaN, Number.NaN]
        const r = el.getBoundingClientRect()
        if (win) return [r.top - margin, r.bottom - margin]
        const v = sc().getBoundingClientRect()
        if (layout === 'horizontal') return [r.left - v.left, r.right - v.left]
        if (layout === 'rtl') return [v.right - r.right, v.right - r.left]
        return [r.top - v.top, r.bottom - v.top]
      }
      const horizontal = layout === 'horizontal' || layout === 'rtl'
      // Current Chromium, WebKit and Firefox all use negative scrollLeft for right-to-left.
      const sign = layout === 'rtl' ? -1 : 1
      const raw = (): number => (horizontal ? sc().scrollLeft : sc().scrollTop)
      const setRaw = (v: number): void => {
        if (horizontal) sc().scrollLeft = v
        else sc().scrollTop = v
      }
      let sampler: (() => number[][]) | null = null
      const probe: AxisProbe = {
        start: (key) => edges(key)[0],
        end: (key) => edges(key)[1],
        offset: () => sign * raw(),
        max: () => (horizontal ? sc().scrollWidth - sc().clientWidth : sc().scrollHeight - sc().clientHeight),
        viewport: () => (horizontal ? sc().clientWidth : sc().clientHeight - (win ? margin : 0)),
        scrollBy(delta) {
          const from = probe.offset()
          setRaw(sign * (from + delta))
          return probe.offset() - from
        },
        keys: () =>
          Array.from(document.getElementById('scroller')!.querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key!),
        startSampler(keys) {
          sampler?.()
          const samples: number[][] = []
          // A ResizeObserver callback runs after layout and every pre-paint correction, once per frame.
          const el = document.createElement('div')
          el.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none'
          document.body.appendChild(el)
          let running = true
          let flip = false
          const ro = new ResizeObserver(() => {
            if (running) samples.push(keys.map((k) => edges(k)[0]))
          })
          ro.observe(el)
          const tick = (): void => {
            if (!running) return
            flip = !flip
            el.style.height = flip ? '2px' : '1px'
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
          sampler = () => {
            running = false
            ro.disconnect()
            el.remove()
            sampler = null
            return samples
          }
        },
        stopSampler: () => sampler?.() ?? [],
      }
      window.__axis = probe
    },
    [layout, margin] as const,
  )
}

type Remote = { [K in keyof AxisProbe]: (...args: Parameters<AxisProbe[K]>) => Promise<ReturnType<AxisProbe[K]>> }

/** A typed proxy that runs `window.__axis[name](...args)` in the page. */
export function axis(page: Page): Remote {
  return new Proxy({} as Remote, {
    get: (_, name: string) =>
      (...args: unknown[]) =>
        page.evaluate(
          ([n, a]) => (window.__axis as unknown as Record<string, (...x: unknown[]) => unknown>)[n as string]!(...(a as unknown[])),
          [name, args] as const,
        ),
  })
}

/**
 * Samples the main-axis start of `key` once per painted frame while `body`
 * runs, and asserts that it moved by at most {@link TOLERANCE}.
 */
export async function stillOnAxis(page: Page, key: string, body: () => Promise<unknown>, label = ''): Promise<void> {
  const a = axis(page)
  await a.startSampler([key])
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))
  await body()
  const samples = (await a.stopSampler()).map((s) => s[0]!)
  const drift = samples.some(Number.isNaN) ? Number.POSITIVE_INFINITY : Math.max(...samples) - Math.min(...samples)
  recordDrift(drift, label)
  expect(samples.length, `${label} frames sampled`).toBeGreaterThanOrEqual(3)
  expect(drift, `${label} drift`).toBeLessThanOrEqual(TOLERANCE)
}
