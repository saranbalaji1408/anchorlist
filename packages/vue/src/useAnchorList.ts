import { createVirtualizer, elementScroller } from '@anchorlist/core'
import type { ElementScrollerOptions, Plan, Virtualizer, VirtualizerOptions } from '@anchorlist/core'
import { getCurrentInstance, onBeforeUnmount, onMounted, onUpdated, shallowRef } from 'vue'

/**
 * Headless Vue binding for `@anchorlist/core`. Call it in `setup()`. It
 * creates one virtualizer per component instance and drives it according to
 * the adapter contract: `plan()` during render, `attach()` + `commit()` in the
 * mounted / updated hooks (after the DOM update, before paint), a synchronous
 * component update for synchronous re-render requests, and `destroy()` on
 * unmount.
 *
 * Call the returned `plan()` in the render function (only there) and render
 * rows `plan.start..plan.end` (inclusive) inside `list`, keyed by
 * `options.getKey(i)`, with a function ref that calls
 * `virtualizer.measureElement(el, key)`. Do not pass the index to row
 * components; the engine writes `data-index` and `aria-posinset` itself.
 * Most apps should use {@link AnchorList} instead.
 *
 * @param options - Returns the virtualizer options for the current render.
 *   Reactive reads inside it re-render the component. `align`,
 *   `initialSnapshot` and `maxCachedSizes` are read once, in `setup()`.
 * @param elements - Returns the scroll container, the list and the optional
 *   content wrapper once they are mounted (for example from refs). Called
 *   after each update until it returns a value.
 * @returns The virtualizer and the render-phase `plan()` function.
 */
export function useAnchorList(
  options: () => VirtualizerOptions,
  elements: () => ElementScrollerOptions | null | undefined,
): readonly [Virtualizer, () => Plan] {
  const instance = getCurrentInstance()!
  // Read by plan() during render, so bumping it schedules a re-render.
  const version = shallowRef(0)
  let rendered: Plan | undefined
  let committed: Plan | undefined
  let attached = false
  let syncing = false
  let again = false

  const commit = (): void => {
    const plan = rendered
    if (!plan || plan === committed) return
    if (!attached) {
      const e = elements()
      if (!e) return
      v.attach(elementScroller(e))
      attached = true
    }
    committed = plan
    v.commit(plan)
  }

  const v = createVirtualizer(options(), {
    render(sync) {
      version.value++
      if (syncing) again = true
      else if (sync) {
        // Vue has no flushSync: run this component's render effect directly
        // (`instance.update`, an internal verified on Vue 3.3 to 3.6), then
        // commit. Requests made by that commit loop here, before paint. The
        // version bump above stays: Vue 3.4+ runs `update` only when dirty.
        // Vue 3.3 re-runs the queued job once more (a no-op re-plan).
        syncing = true
        try {
          do {
            again = false
            instance.update()
            commit()
          } while (again)
        } finally {
          syncing = false
        }
      }
    },
  })

  onMounted(commit)
  onUpdated(commit)
  onBeforeUnmount(() => v.destroy())

  const plan = (): Plan => {
    void version.value
    return (rendered = v.plan(options()))
  }
  return [v, plan]
}
