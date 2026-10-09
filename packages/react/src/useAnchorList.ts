import { createVirtualizer, elementScroller } from '@anchorlist/core'
import type { ElementScrollerOptions, Plan, Virtualizer, VirtualizerOptions } from '@anchorlist/core'
import { useLayoutEffect, useReducer, useState } from 'react'
import { flushSync } from 'react-dom'

const increment = (n: number): number => n + 1
const noop = (): void => {}

/** Per-instance state that must survive re-renders but never triggers one. */
interface Instance {
  /** The virtualizer. */
  v: Virtualizer
  /** Latest re-render function (assigned in a layout effect, so it always belongs to the mounted fiber). */
  f: () => void
  /** Whether a scroller is attached. */
  a: boolean
}

/**
 * Headless React binding for `@anchorlist/core`. Creates one virtualizer per
 * component instance and drives it according to the adapter contract:
 * `plan()` during render (pure, so concurrent and StrictMode renders are
 * safe), `attach()` + `commit()` in a layout effect before paint, `flushSync`
 * for synchronous re-render requests, and `destroy()` on unmount.
 *
 * Render rows `plan.start..plan.end` (inclusive) inside `list`, keyed by
 * `options.getKey(i)`, with a ref that calls
 * `virtualizer.measureElement(el, key)`. Do not pass the index to row
 * components; the engine writes `data-index` and `aria-posinset` itself.
 * Most apps should use {@link AnchorList} instead.
 *
 * @param options - Virtualizer options for this render. `align`,
 *   `initialSnapshot` and `maxCachedSizes` are read on the first render only.
 * @param elements - Returns the scroll container, the list and the optional
 *   content wrapper once they are mounted (for example from refs). Called in
 *   layout effects until it returns a value.
 * @returns The virtualizer and the plan to render.
 */
export function useAnchorList(
  options: VirtualizerOptions,
  elements: () => ElementScrollerOptions | null | undefined,
): readonly [Virtualizer, Plan] {
  // The core only records the visible range and the at-edge state while these
  // callbacks exist, and `getVisibleRange()` / `subscribe()` depend on both.
  options = { onRangeChange: noop, onAtEdgeChange: noop, ...options }
  const [, force] = useReducer(increment, 0)
  const [s] = useState((): Instance => {
    const s: Instance = { f: force, a: false } as Instance
    s.v = createVirtualizer(options, { render: (sync) => (sync ? flushSync(s.f) : s.f()) })
    return s
  })
  const plan = s.v.plan(options)
  useLayoutEffect(() => {
    s.f = force
    if (!s.a) {
      const e = elements()
      if (e) {
        s.v.attach(elementScroller(e))
        s.a = true
      }
    }
    s.v.commit(plan)
  })
  // StrictMode runs this cleanup and then the effects again: the next commit re-attaches.
  useLayoutEffect(
    () => () => {
      s.v.destroy()
      s.a = false
    },
    [s],
  )
  return [s.v, plan]
}
