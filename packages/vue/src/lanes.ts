import { elementScroller, type ElementScrollerOptions, type Plan, type VirtualizerOptions } from '@anchorlist/core'
import type { Lanes } from '@anchorlist/core/lanes'
import { camelize, defineComponent, h, toRaw, type PublicProps, type SetupContext, type SlotsType, type VNode } from 'vue'
import { AnchorList, type AnchorListHandle, type AnchorListProps, type AnchorListSlots } from './AnchorList'

/** Props of {@link LanesList}: those of `AnchorList`, plus the lane layout. */
export interface LanesListProps<T> extends AnchorListProps<T> {
  /**
   * The lane layout from `@anchorlist/core/lanes`: `grid({ lanes: 3 })` or
   * `masonry({ lanes: 3, gap: 8 })`. Create it once per list (for example in
   * `setup()`); it is read on mount. An in-place change to `items` re-lays out
   * the lanes when the list re-renders for it; one that only touches items
   * outside the rendered range waits for the next render (assign a new array to
   * apply it at once).
   */
  lanes: Lanes
}

/**
 * `AnchorList` with items laid out in lanes (a grid or masonry), positioned
 * absolutely. It takes every `AnchorList` prop and slot plus `lanes`; the
 * lanes own the gap, and `padding-start` / `padding-end` are not used. A
 * custom `scroller` (for example `horizontal()` with
 * `grid({ lanes, horizontal: true })`, or `windowScroller`) is wrapped by the
 * lanes. Keep `overscan` (default 400) at least as large as the largest item:
 * masonry items sit up to one item away from their position on the engine's
 * axis, and a grid row at the edge of the overscan may be rendered in part.
 *
 * @example
 * ```vue
 * <script setup lang='ts'>
 * const lanes = masonry({ lanes: 3, gap: 8 })
 * </script>
 * <template>
 *   <LanesList style='height: 600px' :items='photos' :get-key='(p) => p.id' :lanes='lanes'>
 *     <template #default='{ item }'><Photo :photo='item' /></template>
 *   </LanesList>
 * </template>
 * ```
 */
export const LanesList: <T>(
  props: LanesListProps<T> & PublicProps,
  ctx?: Omit<SetupContext<never[], SlotsType<AnchorListSlots<T>>>, 'expose'>,
) => VNode & {
  /** Types for template tooling (the shape `vue-tsc` uses for generic components). */
  __ctx?: { props: LanesListProps<T>; slots: AnchorListSlots<T>; expose(exposed: AnchorListHandle): void; attrs: Record<string, unknown>; emit: unknown }
} = /*#__PURE__*/ defineComponent(
  (props: { lanes: Lanes }, { attrs, slots, expose }) => {
    // Filled from the inner list's handle once it is mounted.
    const handle = {}
    expose(handle)
    // `Object.assign` skips the `null` of an unmount.
    const setList = (r: unknown): unknown => Object.assign(handle, r)
    return () => {
      const { lanes } = props
      // Every other prop arrives as an attribute, in template (kebab) or render-function (camel) case.
      const o: Record<string, unknown> = {}
      for (const k in attrs) o[camelize(k)] = attrs[k]
      const { items, getKey, scroller = elementScroller } = o as unknown as AnchorListProps<unknown>
      // The lanes read the keys of every laid-out item on each sync: through the raw array, so that a
      // scroll render does not read (and track) them all through the reactive proxy.
      const raw = toRaw(items)
      const options: VirtualizerOptions = { ...o, count: items.length, getKey: (i) => getKey(raw[i]) }
      // Hands the items to the lanes before the list plans: its plan reads the lanes' estimates, so a new
      // count, lane layout or gap is laid out first. A Vue render is always committed, and the list
      // commits after this render, in the same flush.
      lanes.sync(options)
      return h(
        AnchorList as never,
        {
          ...attrs,
          // The lanes' estimates, and no gap or padding; `count` is not a list prop, and `getKey` takes items.
          ...lanes.options(options),
          // Syncs again in the list's own render, which also runs alone for an in-place change to rendered
          // items (a swap) that this render does not read; still before the list's commit. Whole rows for
          // a grid: the lanes contract renders `lanes.range(plan, count)`.
          mapRange: (p: Plan): Plan => (lanes.sync(options), { ...p, ...lanes.range(p, p.options.count) }),
          count: undefined,
          getKey,
          ref: setList,
          scroller: (e: ElementScrollerOptions) => {
            // Items are positioned absolutely inside the list.
            e.list.style.position = 'relative'
            // AnchorList leaves overflow to a custom scroller: the default one scrolls the container.
            if (!o.scroller) e.element.style.overflowY = 'auto'
            return lanes.scroller(scroller(e))
          },
        },
        slots,
      )
    }
  },
  { props: ['lanes'], inheritAttrs: false },
) as never
