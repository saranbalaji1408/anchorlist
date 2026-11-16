import type { Virtualizer, VisibleRange } from '@anchorlist/core'
import type { Snippet } from 'svelte'

/** Props of `StickyOverlay`. */
export interface StickyOverlayProps {
  /** The virtualizer passed to the `sticky` snippet of `AnchorList`. */
  list: Pick<Virtualizer, 'subscribe' | 'getVisibleRange'>
  /** The overlay content, rendered from the visible range. */
  children?: Snippet<[range: VisibleRange]> | undefined
}

/** Props of `StickyItem`. */
export interface StickyItemProps<T> {
  /** The visible range from `StickyOverlay`. */
  range: VisibleRange
  /** The list's items (the same array as `AnchorList`'s `items`). */
  items: readonly T[]
  /**
   * Whether an item sticks to the viewport start once scrolled past (for
   * example a group header). Keep it stable (module scope): the walk back to
   * the previous sticky item is remembered while it and `items` stay the same.
   */
  isSticky: (item: T) => boolean
  /** Renders the stuck copy, usually like the list's rows. Give it a background. */
  children?: Snippet<[item: T]> | undefined
}
