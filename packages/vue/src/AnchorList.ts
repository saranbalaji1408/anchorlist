import type { Key, Virtualizer, VirtualizerOptions, VisibleRange } from '@anchorlist/core'
import {
  defineComponent,
  h,
  onBeforeUnmount,
  shallowRef,
  type ComponentPropsOptions,
  type PublicProps,
  type SetupContext,
  type Slots,
  type SlotsType,
  type StyleValue,
  type VNode,
  type VNodeChild,
} from 'vue'
import { useAnchorList } from './useAnchorList'

/**
 * Imperative handle of {@link AnchorList}, available through a template ref.
 * These are the virtualizer methods of `@anchorlist/core`; see its API reference.
 */
export type AnchorListHandle = Pick<
  Virtualizer,
  | 'scrollToKey'
  | 'scrollToIndex'
  | 'scrollToEdge'
  | 'isAtEdge'
  | 'getSnapshot'
  | 'getVisibleRange'
  | 'getItemRect'
  | 'getTotalSize'
  | 'indexOf'
  | 'subscribe'
>

/**
 * Props of {@link AnchorList}. Every `@anchorlist/core` option except `count`
 * and `getKey` is accepted and passed through unchanged (`align`, `overscan`,
 * `gap`, `paddingStart`, `paddingEnd`, `hasMoreStart`, `hasMoreEnd`,
 * `follow`, `initialSnapshot`, ...). Callbacks can be bound as events:
 * `@start-reached`, `@end-reached`, `@range-change`, `@at-edge-change`.
 * `align`, `initialSnapshot` and `maxCachedSizes` are read on mount only.
 * `class`, `style` and other attributes go to the scroll container.
 */
export interface AnchorListProps<T> extends Omit<VirtualizerOptions, 'count' | 'getKey'> {
  /** The items, as an immutable snapshot: pass a new array instead of mutating it. */
  items: readonly T[]
  /** Unique, stable key of an item. The scroll position is anchored to keys. */
  getKey: (item: T) => Key
  /** Class of each row wrapper. Do not give rows margins; use `gap` instead. */
  rowClass?: string
}

/** Slots of {@link AnchorList}. */
export interface AnchorListSlots<T> {
  /**
   * Renders an item. It receives no index, so a prepend re-renders no mounted
   * row. A row re-renders when its item changes or when reactive state read
   * in the slot changes.
   */
  default?: (props: { item: T }) => VNodeChild
  /** Rendered above the rows, inside the scroll content. It may change size at any time. */
  header?: () => VNodeChild
  /** Rendered below the rows, inside the scroll content. It may change size at any time. */
  footer?: () => VNodeChild
  /**
   * Overlay pinned to the top of the viewport (for example a date pill),
   * rendered from the visible range. It re-renders only when that range changes.
   */
  sticky?: (range: VisibleRange) => VNodeChild
}

const ROW: StyleValue = { display: 'flow-root' }
const STICKY: StyleValue = { position: 'sticky', top: 0, height: 0, zIndex: 1 }

/** One row. Its props never include the index, so prepends and trims skip it. */
const Row = defineComponent({
  props: ['v', 'k', 'item', 's', 'c'],
  setup(p) {
    let el: Element | null = null
    // Stable per row (rows are keyed by `k`); Vue calls it again on every patch.
    const ref = (e: unknown): void => {
      if (e !== el) (p.v as Virtualizer).measureElement((el = e as Element | null), p.k as Key)
    }
    return () => h('div', { ref, role: 'listitem', 'data-key': p.k, class: p.c, style: ROW }, (p.s as Slots).default?.({ item: p.item }))
  },
})

const Sticky = defineComponent({
  props: ['v', 's'],
  setup(p) {
    const v = p.v as Virtualizer
    const range = shallowRef(v.getVisibleRange())
    onBeforeUnmount(v.subscribe(() => (range.value = v.getVisibleRange())))
    return () => h('div', { style: STICKY }, (p.s as Slots).sticky?.(range.value))
  },
})

const PROPS: ComponentPropsOptions = {
  hasMoreStart: Boolean,
  hasMoreEnd: Boolean,
  // Absent means "follow if pinned", not false.
  follow: { type: [Boolean, Function], default: undefined },
}
for (const k of (
  'items getKey rowClass estimateSize align overscan gap paddingStart paddingEnd startThreshold endThreshold ' +
  'onStartReached onEndReached atEdgeThreshold onRangeChange onAtEdgeChange initialSnapshot maxCachedSizes'
).split(' '))
  PROPS[k] = null

/**
 * Virtual list with stable scroll anchoring. It renders only the rows near the
 * viewport and keeps the row being read in place while items are prepended,
 * appended, trimmed, removed or resized.
 *
 * - `align="end"` pins the list to the bottom (chat: it opens at the newest
 *   item and follows appends while pinned).
 * - `align="start"` (default) pins it to the top (feeds).
 *
 * The scroll container needs a fixed size (`style="height: 600px"`). Rows are
 * rendered in a flex column; `data-index`, `aria-posinset` and `aria-setsize`
 * are written by the engine, and each row has `data-key`. Rows never mount in
 * the same update as the scroll container.
 *
 * @example
 * ```vue
 * <AnchorList
 *   style="height: 600px"
 *   :items="messages"
 *   :get-key="(m) => m.id"
 *   align="end"
 *   :has-more-start="hasOlder"
 *   @start-reached="loadOlder"
 * >
 *   <template #default="{ item }"><Bubble :message="item" /></template>
 * </AnchorList>
 * ```
 */
export const AnchorList: <T>(
  props: AnchorListProps<T> & PublicProps,
  ctx?: Omit<SetupContext<never[], SlotsType<AnchorListSlots<T>>>, 'expose'>,
) => VNode & {
  /** Types for template tooling (the shape `vue-tsc` uses for generic components). */
  __ctx?: { props: AnchorListProps<T>; slots: AnchorListSlots<T>; expose(exposed: AnchorListHandle): void; attrs: Record<string, unknown>; emit: unknown }
} = defineComponent(
  (props: AnchorListProps<unknown>, { slots, expose }) => {
    let element: HTMLElement | undefined
    let content: HTMLElement
    let list: HTMLElement
    const setElement = (e: unknown): unknown => (element = e as HTMLElement)
    const setContent = (e: unknown): unknown => (content = e as HTMLElement)
    const setList = (e: unknown): unknown => (list = e as HTMLElement)
    const [v, plan] = useAnchorList(
      () => {
        // A snapshot: the engine calls getKey for the list as it was when planned.
        const { items, getKey } = props
        return { ...props, count: items.length, getKey: (i) => getKey(items[i]) }
      },
      () => element && { element, list, content },
    )
    expose(v)
    return () => {
      const p = plan()
      const { items, getKey, gap } = props
      const rows: VNode[] = []
      for (let i = p.start; i <= p.end; i++) {
        const item = items[i]
        const k = getKey(item)
        rows.push(h(Row, { key: k, k, v, item, s: slots, c: props.rowClass }))
      }
      return h('div', { ref: setElement, style: { overflowY: 'auto', overflowAnchor: 'none' } }, [
        slots.sticky && h(Sticky, { v, s: slots }),
        h('div', { ref: setContent }, [
          slots.header?.(),
          h(
            'div',
            {
              ref: setList,
              role: 'list',
              style: { display: 'flex', flexDirection: 'column', gap: gap ? `${gap}px` : undefined },
            },
            rows,
          ),
          slots.footer?.(),
        ]),
      ])
    }
  },
  { name: 'AnchorList', props: PROPS as never },
) as never
