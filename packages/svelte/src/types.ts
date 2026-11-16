import type { ElementScrollerOptions, Key, Plan, Range, Scroller, Virtualizer, VirtualizerOptions } from '@anchorlist/core'
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

/**
 * Methods of {@link AnchorList} available through `bind:this`: the virtualizer
 * methods of `@anchorlist/core` (see its API reference) and `getElement`.
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
  /** The scroll container (for example for `animateToKey` from `@anchorlist/core/animate`). Available once mounted. */
  getElement(): HTMLDivElement
}

/**
 * Props of {@link AnchorList}. Every `@anchorlist/core` option except `count`
 * and `getKey` is accepted and passed through unchanged (`align`, `overscan`,
 * `gap`, `paddingStart`, `paddingEnd`, `hasMoreStart`, `hasMoreEnd`,
 * `onStartReached`, `onEndReached`, `follow`, `onRangeChange`,
 * `onAtEdgeChange`, `initialSnapshot`, `initialRect`, `initialPlan`, ...).
 * `align`, `initialSnapshot` and `maxCachedSizes` are read on mount only. With
 * `initialRect` and `initialPlan` (from `@anchorlist/core/ssr`), server and
 * hydration renders include the rows that fill it. Other attributes (`class`, `style`,
 * `id`, `aria-label`, event handlers, ...) go to the scroll container.
 */
/** Core options; `undefined` means the default, so `prop={cond ? x : undefined}` works. */
type Options = { [K in Exclude<keyof VirtualizerOptions, 'count' | 'getKey'>]?: VirtualizerOptions[K] | undefined }

export interface AnchorListProps<T> extends Options, Omit<HTMLAttributes<HTMLDivElement>, keyof VirtualizerOptions | 'children'> {
  /** The items, as an immutable snapshot: assign a new array instead of mutating it. */
  items: readonly T[]
  /** Unique, stable key of an item. The scroll position is anchored to keys. */
  getKey: (item: T) => Key
  /**
   * Renders an item. It receives no index, so a prepend updates no mounted
   * row. A row updates when its item changes or when state read in the
   * snippet changes.
   */
  children?: Snippet<[item: T]> | undefined
  /** Rendered above the rows, inside the scroll content. It may change size at any time. */
  header?: Snippet | undefined
  /** Rendered below the rows, inside the scroll content. It may change size at any time. */
  footer?: Snippet | undefined
  /**
   * Rendered first inside the scroll container, with the virtualizer. Put a
   * `StickyOverlay` from `@anchorlist/svelte/sticky` here: an overlay pinned to
   * the top of the viewport (for example a date pill or sticky group headers),
   * rendered from the visible range.
   */
  sticky?: Snippet<[list: Virtualizer]> | undefined
  /** Class of each row wrapper. Do not give rows margins; use `gap` instead. */
  rowClass?: string | undefined
  /** Sets `aria-busy` on the list, for example while a page of items is loading. */
  busy?: boolean | undefined
  /**
   * Creates the scroller on mount. Default: `elementScroller`, with the
   * container as a vertical scroll container. With a custom scroller the
   * container gets no `overflow` style of its own. Read on mount.
   * - `windowScroller` from `@anchorlist/core/window` scrolls with the page.
   * - `horizontal()` from `@anchorlist/svelte/horizontal` lays the list out
   *   horizontally; `horizontal(rtlScroller)` (with `rtlScroller` from
   *   `@anchorlist/core/rtl`) also handles right-to-left, which a horizontal
   *   list under `dir="rtl"` needs.
   */
  scroller?: ((elements: ElementScrollerOptions) => Scroller<Element>) | undefined
  /**
   * The rows to render for a plan, for layouts that render other rows than the
   * plan's range (`LanesList` renders whole grid rows). Default: the plan's range.
   */
  rows?: ((plan: Plan) => Range) | undefined
}
