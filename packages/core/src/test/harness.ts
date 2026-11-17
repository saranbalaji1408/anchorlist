import { simulatedScroller, type SimulatedElement, type SimulatedScroller, type SimulatedScrollerOptions } from '../simulatedScroller'
import type { Key, Range } from '../types'
import { createVirtualizer, type Virtualizer, type VirtualizerOptions } from '../virtualizer'

/** Test host options: the item list, true sizes and virtualizer options. */
export interface HarnessOptions extends SimulatedScrollerOptions {
  /** Initial keys. */
  keys: Key[]
  /** True size of an item (what the simulated DOM measures). */
  size: (key: Key) => number
  /** Extra virtualizer options. */
  options?: Partial<VirtualizerOptions>
}

/** A virtualizer mounted on a simulated scroller, rendered by a minimal synchronous host. */
export interface Harness {
  v: Virtualizer
  sim: SimulatedScroller
  /** Current item keys. */
  keys: Key[]
  /** True sizes by key. */
  sizes: Map<Key, number>
  /** Mounted elements by key. */
  mounted: Map<Key, SimulatedElement>
  /** Number of host renders so far. */
  renders: number
  /** Last committed plan. */
  range: Range
  /** Replaces the keys and re-renders (like a state update). */
  setKeys(next: Key[], options?: Partial<VirtualizerOptions>): void
  /** Re-renders with new options and the same keys. */
  setOptions(options: Partial<VirtualizerOptions>): void
  /** Changes the true size of an item (mounted or not). */
  resize(key: Key, size: number): void
  /** Delivers events, microtasks and frames until quiet. */
  settle(frames?: number): Promise<void>
  /** Viewport-relative start of a mounted item, or undefined. */
  visualStart(key: Key): number | undefined
  /** Viewport-relative end of a mounted item, or undefined. */
  visualEnd(key: Key): number | undefined
}

/** Mounts a virtualizer on a simulated scroller. */
export function mount(o: HarnessOptions): Harness {
  const sim = simulatedScroller(o)
  const sizes = new Map<Key, number>()
  let extra: Partial<VirtualizerOptions> = o.options ?? {}
  let dirty = false
  let flushing = false

  const options = (keys: Key[]): VirtualizerOptions => ({
    ...extra,
    gap: o.gap ?? 0,
    count: keys.length,
    getKey: (i) => keys[i] as Key,
  })

  const h: Harness = {
    v: undefined as unknown as Virtualizer,
    sim,
    keys: o.keys,
    sizes,
    mounted: new Map(),
    renders: 0,
    range: { start: 0, end: -1 },
    setKeys(next, opts) {
      if (opts) extra = { ...extra, ...opts }
      h.keys = next
      host.render()
    },
    setOptions(opts) {
      h.setKeys(h.keys, opts)
    },
    resize(key, size) {
      sizes.set(key, size)
      const el = h.mounted.get(key)
      if (el) sim.resizeElement(el, size)
    },
    async settle(frames = 6) {
      for (let i = 0; i < frames; i++) {
        await Promise.resolve()
        sim.tick()
      }
      await Promise.resolve()
    },
    visualStart(key) {
      const el = h.mounted.get(key)
      return el ? sim.measure(el).start : undefined
    },
    visualEnd(key) {
      const el = h.mounted.get(key)
      return el ? sim.measure(el).start + el.size : undefined
    },
  }

  const sizeOf = (key: Key): number => {
    if (!sizes.has(key)) sizes.set(key, o.size(key))
    return sizes.get(key)!
  }

  const renderOnce = (): void => {
    h.renders++
    const keys = h.keys
    const plan = h.v.plan(options(keys))
    const next = new Map<Key, SimulatedElement>()
    const rows: SimulatedElement[] = []
    for (let i = plan.start; i <= plan.end; i++) {
      const key = keys[i] as Key
      const el = h.mounted.get(key) ?? { size: sizeOf(key) }
      next.set(key, el)
      rows.push(el)
    }
    h.mounted.forEach((_, key) => next.has(key) || h.v.measureElement(null, key))
    next.forEach((el, key) => h.mounted.has(key) || h.v.measureElement(el, key))
    h.mounted = next
    sim.setRows(rows)
    h.range = plan
    h.v.commit(plan)
  }

  const host = {
    render() {
      dirty = true
      if (flushing) return
      flushing = true
      try {
        for (let guard = 0; dirty && guard < 50; guard++) {
          dirty = false
          renderOnce()
        }
      } finally {
        flushing = false
      }
    },
  }

  h.v = createVirtualizer(options(o.keys), host)
  // First render: no scroller yet, so nothing is mounted.
  renderOnce()
  h.v.attach(sim)
  host.render()
  return h
}

/** `count` keys named `${prefix}${i}`, starting at `from`. */
export const keysOf = (count: number, prefix = 'k', from = 0): Key[] =>
  Array.from({ length: count }, (_, i) => `${prefix}${from + i}`)
