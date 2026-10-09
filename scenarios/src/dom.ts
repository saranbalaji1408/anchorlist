/**
 * Framework-neutral DOM probes, installed into every fixture's driver. They
 * read the anchorlist DOM structure only (scroll container `#scroller`, rows
 * with `data-key`).
 */

/**
 * A value sampled once per painted frame:
 * - `top:<key>` / `bottom:<key>`: row edge relative to the viewport top;
 * - `fromBottom:<key>`: viewport bottom minus the row bottom;
 * - `distEnd`: scrollHeight - scrollTop - clientHeight;
 * - `rows`: number of mounted rows;
 * - `scrollTop`.
 */
export type Probe = `top:${string}` | `bottom:${string}` | `fromBottom:${string}` | 'distEnd' | 'rows' | 'scrollTop'

/** Bounding box along the vertical axis. */
export interface VRect {
  top: number
  bottom: number
  height: number
}

/** DOM helpers available on every driver. */
export interface Dom {
  hasScroller(): boolean
  /** Row rect relative to the viewport top. Throws when not mounted. */
  rowRect(key: string): VRect
  isMounted(key: string): boolean
  /** Key of the mounted row containing `y` px below the viewport top. */
  rowAt(y: number): string
  mountedKeys(): string[]
  /** Distance to the end (`'end'`) or start of the scroll range. */
  distanceTo(edge: 'start' | 'end'): number
  scrollTop(): number
  scrollHeight(): number
  /** Sets scrollTop like a user scroll and waits `frames` frames (default 2). Returns the applied delta. */
  scrollBy(delta: number, frames?: number): Promise<number>
  scrollToTop(value: number, frames?: number): Promise<void>
  /** Dispatches a DOM event of `type` on the scroll container. */
  dispatch(type: string): void
  /** Inline transform of the content wrapper (the list's parent). */
  contentTransform(): string
  pillText(): string | null
  /** Resolves after `n` full frames, rendering steps included. */
  frames(n?: number): Promise<void>
  wait(ms: number): Promise<void>
  /**
   * Starts sampling `probes` once per painted frame, after every pre-paint
   * correction (a ResizeObserver on a probe element toggled from rAF).
   * Frames without a scroll container are skipped. Failed reads give NaN.
   */
  startSampler(probes: Probe[]): void
  /** Stops the sampler and returns one array of values per frame. */
  stopSampler(): number[][]
  /** Patches ResizeObserver.prototype.disconnect to count calls. */
  countDisconnects(): void
  disconnects(): number
}

/** Creates the DOM helpers for the scroll container with `id`. */
export function createDom(id = 'scroller'): Dom {
  const scroller = (): HTMLElement => {
    const el = document.getElementById(id)
    if (!el) throw new Error('scroller not mounted')
    return el
  }
  const row = (key: string): HTMLElement | null =>
    document.getElementById(id)?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? null
  const top = (): number => scroller().getBoundingClientRect().top
  const rowRect = (key: string): VRect => {
    const el = row(key)
    if (!el) throw new Error(`row ${key} not mounted`)
    const r = el.getBoundingClientRect()
    const t = top()
    return { top: r.top - t, bottom: r.bottom - t, height: r.height }
  }
  const rows = (): HTMLElement[] => Array.from(scroller().querySelectorAll<HTMLElement>('[data-key]'))
  const frames = async (n = 2): Promise<void> => {
    for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))
  }
  const read = (p: Probe): number => {
    const sc = scroller()
    if (p === 'distEnd') return sc.scrollHeight - sc.scrollTop - sc.clientHeight
    if (p === 'rows') return rows().length
    if (p === 'scrollTop') return sc.scrollTop
    const [kind, key] = [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)]
    const r = rowRect(key)
    return kind === 'top' ? r.top : kind === 'bottom' ? r.bottom : sc.clientHeight - r.bottom
  }

  let sampler: { stop: () => number[][] } | null = null
  let disconnects = 0

  return {
    hasScroller: () => !!document.getElementById(id),
    rowRect,
    isMounted: (key) => !!row(key),
    rowAt(y) {
      const t = top() + y
      const hit = rows().find((el) => {
        const r = el.getBoundingClientRect()
        return r.top <= t && r.bottom > t
      })
      if (!hit?.dataset.key) throw new Error(`no row at ${y}`)
      return hit.dataset.key
    },
    mountedKeys: () => rows().map((el) => el.dataset.key ?? ''),
    distanceTo(edge) {
      const sc = scroller()
      return edge === 'start' ? sc.scrollTop : sc.scrollHeight - sc.scrollTop - sc.clientHeight
    },
    scrollTop: () => scroller().scrollTop,
    scrollHeight: () => scroller().scrollHeight,
    async scrollBy(delta, n = 2) {
      const sc = scroller()
      const from = sc.scrollTop
      sc.scrollTop = from + delta
      const applied = sc.scrollTop - from
      await frames(n)
      return applied
    },
    async scrollToTop(value, n = 2) {
      scroller().scrollTop = value
      await frames(n)
    },
    dispatch: (type) => void scroller().dispatchEvent(new Event(type)),
    contentTransform: () => scroller().querySelector<HTMLElement>('[role="list"]')?.parentElement?.style.transform ?? '',
    pillText: () => document.querySelector('[data-testid="pill"]')?.textContent ?? null,
    frames,
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    startSampler(probes) {
      sampler?.stop()
      const samples: number[][] = []
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none'
      document.body.appendChild(el)
      let running = true
      let flip = false
      const ro = new ResizeObserver(() => {
        if (!running || !document.getElementById(id)) return
        samples.push(
          probes.map((p) => {
            try {
              return read(p)
            } catch {
              return Number.NaN
            }
          }),
        )
      })
      ro.observe(el)
      const tick = (): void => {
        if (!running) return
        flip = !flip
        el.style.height = flip ? '2px' : '1px'
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      sampler = {
        stop() {
          running = false
          ro.disconnect()
          el.remove()
          sampler = null
          return samples
        },
      }
    },
    stopSampler: () => sampler?.stop() ?? [],
    countDisconnects() {
      const proto = ResizeObserver.prototype
      const original = proto.disconnect
      proto.disconnect = function (this: ResizeObserver) {
        disconnects++
        return original.call(this)
      }
    },
    disconnects: () => disconnects,
  }
}
