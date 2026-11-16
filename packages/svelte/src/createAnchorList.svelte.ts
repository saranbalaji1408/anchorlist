import { createVirtualizer, elementScroller, keptRow } from '@anchorlist/core'
import type { ElementScrollerOptions, Key, KeptRow, Plan, Scroller, Virtualizer, VirtualizerOptions } from '@anchorlist/core'
import { flushSync, untrack } from 'svelte'

/** The state returned by {@link createAnchorList}. */
export interface AnchorListState {
  /** The virtualizer. */
  readonly virtualizer: Virtualizer
  /** The plan to render (reactive). */
  readonly plan: Plan
  /**
   * The row to keep mounted outside the plan (reactive), or `null`: the row
   * with the {@link focused} key while it is out of range. Render it out of
   * flow at `start` (see `keptRow` in `@anchorlist/core`), with the planned
   * rows in the same keyed block, before them when `index < plan.start`.
   */
  readonly kept: KeptRow | null
  /**
   * Key of the row containing focus, or `null`. Set it when focus enters a
   * row and clear it when focus leaves the list; it takes effect on the next
   * plan.
   */
  focused: Key | null
}

/**
 * Headless Svelte 5 binding for `@anchorlist/core`. Call it during component
 * initialisation. It creates one virtualizer per component instance and
 * drives it according to the adapter contract: `plan()` in a derived value,
 * `attach()` + `commit()` in an effect after the DOM update and before paint,
 * `flushSync` for synchronous re-render requests, and `destroy()` on unmount.
 *
 * Render rows `plan.start..plan.end` (inclusive) and the {@link AnchorListState.kept}
 * row as the only children of `list`, in order, keyed by `options.getKey(i)`,
 * each with `data-key={key}`. Rows are registered from the DOM by `data-key`
 * before each commit, so they need no ref. Do not pass the index to rows; the
 * engine writes `data-index` and `aria-posinset` itself. Most apps should use
 * `AnchorList` instead.
 *
 * @param options - Returns the virtualizer options. Reactive reads inside it
 *   update the plan. `align`, `initialSnapshot` and `maxCachedSizes` are read
 *   once, on creation. With `initialRect` and `initialPlan` (from
 *   `@anchorlist/core/ssr`), server and hydration renders include the rows
 *   that fill it.
 * @param elements - Returns the scroll container, the list and the optional
 *   content wrapper once they are mounted (for example from `bind:this`).
 * @param scroller - Creates the scroller from `elements` when attaching.
 *   Default `elementScroller`; for example `windowScroller` from
 *   `@anchorlist/core/window`.
 * @returns The virtualizer, the reactive plan and focus preservation.
 */
export function createAnchorList(
  options: () => VirtualizerOptions,
  elements: () => ElementScrollerOptions | null | undefined,
  scroller: (elements: ElementScrollerOptions) => Scroller<Element> = elementScroller,
): AnchorListState {
  let version = $state(0)
  /** Whether the commit effect is running. */
  let committing = false
  const v = createVirtualizer(untrack(options), {
    // Inside commit (an effect) the update joins the running flush, before
    // paint. Other async requests (resize callbacks) wait for a task, like a
    // React state update: a microtask would mount and observe rows inside the
    // ResizeObserver delivery loop, which WebKit reports as a loop error.
    render: (sync) => (sync ? (version++, flushSync()) : committing ? version++ : setTimeout(() => version++)),
  })
  const plan = $derived.by(() => {
    void version
    const o = options()
    // `initialPlan` (server rendering) also plans the renders before attach.
    return o.initialPlan ? o.initialPlan(v, o) : v.plan(o)
  })
  const state = {
    virtualizer: v,
    focused: null as Key | null,
    get plan() {
      return plan
    },
    get kept() {
      return kept
    },
  }
  // Not reactive on `focused`: focus moves without a re-render; the next plan picks it up.
  const kept = $derived(keptRow(v, plan, state.focused))
  const rows = new Map<Key, Element>()
  let e: ElementScrollerOptions | null | undefined

  $effect(() => {
    const p = plan
    const k = kept
    committing = true
    untrack(() => {
      if (!e && (e = elements())) v.attach(scroller(e))
      if (!e) return
      // Rows are paired with plan keys by `data-key`, never by position, so
      // other children (or rows still outroing) are never measured as rows.
      const keys = new Map<string, Key>()
      const add = (i: number): void => {
        const key = p.options.getKey(i)
        keys.set(String(key), key)
      }
      for (let i = p.start; i <= p.end; i++) add(i)
      if (k) add(k.index)
      const seen = new Set<Key>()
      for (const el of (e.list as Element).children) {
        const key = keys.get(el.getAttribute('data-key')!)
        if (key === undefined || seen.has(key)) continue
        seen.add(key)
        if (rows.get(key) !== el) {
          rows.set(key, el)
          v.measureElement(el, key)
        }
      }
      rows.forEach((_, key) => seen.has(key) || (rows.delete(key), v.measureElement(null, key)))
      v.commit(p)
    })
    committing = false
  })
  $effect(() => () => v.destroy())

  return state
}
