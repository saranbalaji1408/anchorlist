import { keptRow, type ElementScrollerOptions, type Key, type Scroller, type Virtualizer, type VirtualizerOptions, type VisibleRange } from '@anchorlist/core'
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
 * Imperative handle of {@link AnchorList}, available through a template ref:
 * the virtualizer methods of `@anchorlist/core` (see its API reference) and
 * the scroll container `element` (for example for `animateToKey` from
 * `@anchorlist/core/animate`).
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
> & {
  /** The scroll container (once mounted). */
  readonly element: HTMLElement
}

/**
 * Props of {@link AnchorList}. Every `@anchorlist/core` option except `count`
 * and `getKey` is accepted and passed through unchanged (`align`, `overscan`,
 * `gap`, `paddingStart`, `paddingEnd`, `hasMoreStart`, `hasMoreEnd`,
 * `follow`, `initialSnapshot`, `initialRect`, `initialPlan`, ...). Callbacks
 * can be bound as events: `@start-reached`, `@end-reached`, `@range-change`,
 * `@at-edge-change`. `align`, `initialSnapshot` and `maxCachedSizes` are read
 * on mount only. With `initialRect` and `initialPlan` (from
 * `@anchorlist/core/ssr`), server and hydration renders include the rows that
 * fill it. `class`, `style` and other attributes go to the scroll container.
 */
export interface AnchorListProps<T> extends Omit<VirtualizerOptions, 'count' | 'getKey'> {
  /** The items, as an immutable snapshot: pass a new array instead of mutating it. */
  items: readonly T[]
  /** Unique, stable key of an item. The scroll position is anchored to keys. */
  getKey: (item: T) => Key
  /** Class of each row wrapper. Do not give rows margins; use `gap` instead. */
  rowClass?: string
  /** Sets `aria-busy` on the list, for example while a page of items is loading. */
  busy?: boolean
  /**
   * Creates the scroller on mount. Default: `elementScroller`, with the
   * container as a vertical scroll container. With a custom scroller the
   * container gets no `overflow` style. Read on mount.
   * - `windowScroller` from `@anchorlist/core/window` scrolls with the page.
   * - `horizontal()` from `@anchorlist/vue/horizontal` lays the list out
   *   horizontally; `horizontal(rtlScroller)` (with `rtlScroller` from
   *   `@anchorlist/core/rtl`) also handles right-to-left, which a horizontal
   *   list under `dir="rtl"` needs.
   */
  scroller?: (elements: ElementScrollerOptions) => Scroller<Element>
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
const Row = /*#__PURE__*/ defineComponent({
  // `f` receives the key of the row containing focus; `st` is its style (out of flow while kept).
  props: ['v', 'k', 'item', 's', 'c', 'st', 'f'],
  setup(p) {
    let el: Element | null = null
    // Stable per row (rows are keyed by `k`); Vue calls it again on every patch.
    const ref = (e: unknown): void => {
      if (e !== el) (p.v as Virtualizer).measureElement((el = e as Element | null), p.k as Key)
    }
    // `focusin` bubbles from the row's content, unlike `focus`.
    const onFocusin = (): void => (p.f as (k: Key) => void)(p.k as Key)
    return () => h('div', { ref, role: 'listitem', 'data-key': p.k, class: p.c, style: p.st, onFocusin }, (p.s as Slots).default?.({ item: p.item }))
  },
})

const Sticky = /*#__PURE__*/ defineComponent({
  props: ['v', 's'],
  setup(p) {
    const v = p.v as Virtualizer
    const range = shallowRef(v.getVisibleRange())
    onBeforeUnmount(v.subscribe(() => (range.value = v.getVisibleRange())))
    return () => h('div', { style: STICKY }, (p.s as Slots).sticky?.(range.value))
  },
})

// A pure IIFE, so the bundle stays tree-shakable (`useAnchorList` alone drops it).
const PROPS: ComponentPropsOptions = /*#__PURE__*/ (() => {
  const props: ComponentPropsOptions = {
    hasMoreStart: Boolean,
    hasMoreEnd: Boolean,
    busy: Boolean,
    // Absent means "follow if pinned", not false.
    follow: { type: [Boolean, Function], default: undefined },
  }
  for (const k of (
    'items getKey rowClass estimateSize align overscan gap paddingStart paddingEnd startThreshold endThreshold ' +
    'onStartReached onEndReached atEdgeThreshold onRangeChange onAtEdgeChange initialSnapshot maxCachedSizes ' +
    'initialRect initialPlan scroller'
  ).split(' '))
    props[k] = null
  return props
})()

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
} = /*#__PURE__*/ defineComponent(
  (props: AnchorListProps<unknown>, { slots, expose }) => {
    let element: HTMLElement | undefined
    let content: HTMLElement
    let list: HTMLElement | undefined
    /** Key of the row containing focus. */
    let focused: Key | null = null
    const setElement = (e: unknown): unknown => (element = handle.element = e as HTMLElement)
    const setContent = (e: unknown): unknown => (content = e as HTMLElement)
    const setList = (e: unknown): unknown => (list = e as HTMLElement)
    const setFocused = (k: Key): unknown => (focused = k)
    const [v, plan] = useAnchorList(
      () => {
        // A snapshot: the engine calls getKey for the list as it was when planned.
        const { items, getKey } = props
        return { ...props, count: items.length, getKey: (i) => getKey(items[i]) }
      },
      () => element && { element, list: list!, content },
      props.scroller,
    )
    // Exposed raw, so the element assigned on mount is visible through the template ref.
    const handle = { ...v, element: undefined as never } as { -readonly [K in keyof AnchorListHandle]: AnchorListHandle[K] }
    expose(handle)
    return () => {
      const p = plan()
      const { items, getKey, gap } = props
      const row = (i: number, st: StyleValue = ROW): VNode => {
        const item = items[i]
        const k = getKey(item)
        return h(Row, { key: k, k, v, item, s: slots, c: props.rowClass, st, f: setFocused })
      }
      const rows: VNode[] = []
      for (let i = p.start; i <= p.end; i++) rows.push(row(i))
      // The focused row stays mounted outside the range, out of flow, in the same
      // keyed array as the rows so that Vue never moves its node (see keptRow).
      const kept = keptRow(v, p, focused)
      // A horizontal list (`horizontal()` lays the rows out in a row) keeps it at its inline start, which
      // is the left edge, or the right edge in a right-to-left scroll container: content space either way.
      const x = list?.style.flexDirection == 'row'
      if (kept)
        rows[kept.index < p.start ? 'unshift' : 'push'](
          row(kept.index, { position: 'absolute', [x ? 'height' : 'width']: '100%', [x ? 'insetInlineStart' : 'top']: `${kept.start}px` }),
        )
      return h(
        'div',
        // Vue writes every key of a style object on each patch: keys a scroller writes (`overflowY` for a
        // custom one, `flexDirection` below) are left out or read back, so a re-render keeps them.
        { ref: setElement, style: { overflowAnchor: 'none', position: 'relative', ...(!props.scroller && { overflowY: 'auto' }) } },
        [
          slots.sticky && h(Sticky, { v, s: slots }),
          h('div', { ref: setContent }, [
            slots.header?.(),
            h(
              'div',
              {
                ref: setList,
                role: 'list',
                'aria-busy': props.busy || undefined,
                style: { display: 'flex', flexDirection: x ? 'row' : 'column', gap: gap ? `${gap}px` : undefined },
                // Focus that leaves the window stays in the row: keep it.
                onFocusout: () => {
                  if (document.hasFocus()) focused = null
                },
              },
              rows,
            ),
            slots.footer?.(),
          ]),
        ],
      )
    }
  },
  { name: 'AnchorList', props: PROPS as never },
) as never
