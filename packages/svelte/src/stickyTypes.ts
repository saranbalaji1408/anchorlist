import type { VisibleRange } from '@anchorlist/core'
import type { Snippet } from 'svelte'

/** Props of `StickyItem`. */
export interface StickyItemProps<T> {
  /** The visible range passed to the `sticky` snippet of `AnchorList`. */
  range: VisibleRange
  /** The list's items (the same array as `AnchorList`'s `items`). */
  items: readonly T[]
  /** Whether an item sticks to the viewport start once scrolled past (for example a group header). */
  isSticky: (item: T) => boolean
  /** Renders the stuck copy, usually like the list's rows. Give it a background. */
  children?: Snippet<[item: T]> | undefined
}
