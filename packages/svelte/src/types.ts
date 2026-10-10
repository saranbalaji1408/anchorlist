import type { Key, Virtualizer, VirtualizerOptions, VisibleRange } from '@anchorlist/core'
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

/**
 * Methods of {@link AnchorList} available through `bind:this`. These are the
 * virtualizer methods of `@anchorlist/core`; see its API reference.
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
 * `onStartReached`, `onEndReached`, `follow`, `onRangeChange`,
 * `onAtEdgeChange`, `initialSnapshot`, ...). `align`, `initialSnapshot` and
 * `maxCachedSizes` are read on mount only. Other attributes (`class`, `style`,
 * `id`, `aria-label`, event handlers, ...) go to the scroll container.
 */
export interface AnchorListProps<T>
  extends Omit<VirtualizerOptions, 'count' | 'getKey'>,
    Omit<HTMLAttributes<HTMLDivElement>, keyof VirtualizerOptions | 'children'> {
  /** The items, as an immutable snapshot: assign a new array instead of mutating it. */
  items: readonly T[]
  /** Unique, stable key of an item. The scroll position is anchored to keys. */
  getKey: (item: T) => Key
  /**
   * Renders an item. It receives no index, so a prepend updates no mounted
   * row. A row updates when its item changes or when state read in the
   * snippet changes.
   */
  children?: Snippet<[item: T]>
  /** Rendered above the rows, inside the scroll content. It may change size at any time. */
  header?: Snippet
  /** Rendered below the rows, inside the scroll content. It may change size at any time. */
  footer?: Snippet
  /**
   * Overlay pinned to the top of the viewport (for example a date pill),
   * rendered from the visible range. It updates only when that range changes.
   */
  sticky?: Snippet<[range: VisibleRange]>
  /** Class of each row wrapper. Do not give rows margins; use `gap` instead. */
  rowClass?: string
}
