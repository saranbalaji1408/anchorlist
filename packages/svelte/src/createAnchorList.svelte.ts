import { createVirtualizer, elementScroller } from '@anchorlist/core'
import type { ElementScrollerOptions, Key, Plan, Virtualizer, VirtualizerOptions } from '@anchorlist/core'
import { flushSync, untrack } from 'svelte'

/** The state returned by {@link createAnchorList}. */
export interface AnchorListState {
  /** The virtualizer. */
  readonly virtualizer: Virtualizer
  /** The plan to render (reactive). */
  readonly plan: Plan
}

/**
 * Headless Svelte 5 binding for `@anchorlist/core`. Call it during component
 * initialisation. It creates one virtualizer per component instance and
 * drives it according to the adapter contract: `plan()` in a derived value,
 * `attach()` + `commit()` in an effect after the DOM update and before paint,
 * `flushSync` for synchronous re-render requests, and `destroy()` on unmount.
 *
 * Render rows `plan.start..plan.end` (inclusive) as the only children of
 * `list`, in order, keyed by `options.getKey(i)`. Rows are registered from
 * the DOM before each commit, so they need no ref. Do not pass the index to
 * rows; the engine writes `data-index` and `aria-posinset` itself. Most apps
 * should use `AnchorList` instead.
 *
 * @param options - Returns the virtualizer options. Reactive reads inside it
 *   update the plan. `align`, `initialSnapshot` and `maxCachedSizes` are read
 *   once, on creation.
 * @param elements - Returns the scroll container, the list and the optional
 *   content wrapper once they are mounted (for example from `bind:this`).
 * @returns The virtualizer and the reactive plan.
 */
export function createAnchorList(
  options: () => VirtualizerOptions,
  elements: () => ElementScrollerOptions | null | undefined,
): AnchorListState {
  let version = $state(0)
  const v = createVirtualizer(
    untrack(options),
    // Inside commit (an effect) the update joins the running flush, before paint.
    { render: (sync) => (version++, sync && flushSync()) },
  )
  const plan = $derived.by(() => {
    void version
    return v.plan(options())
  })
  const rows = new Map<Key, Element>()
  let e: ElementScrollerOptions | null | undefined

  $effect(() => {
    const p = plan
    untrack(() => {
      if (!e && (e = elements())) v.attach(elementScroller(e))
      if (!e) return
      // The list's children are the rendered rows, in plan order.
      const seen = new Set<Key>()
      const kids = (e.list as Element).children
      for (let j = 0; j < kids.length; j++) {
        const key = p.options.getKey(p.start + j)
        seen.add(key)
        if (rows.get(key) !== kids[j]) {
          rows.set(key, kids[j]!)
          v.measureElement(kids[j], key)
        }
      }
      rows.forEach((_, key) => seen.has(key) || (rows.delete(key), v.measureElement(null, key)))
      v.commit(p)
    })
  })
  $effect(() => () => v.destroy())

  return {
    virtualizer: v,
    get plan() {
      return plan
    },
  }
}
