import { elementScroller, HORIZONTAL } from '@anchorlist/core'
import type { ElementScrollerOptions, Scroller } from '@anchorlist/core'

/** Creates a scroller from the elements of a list (the `scroller` prop of `AnchorList`). */
export type ScrollerFactory = (elements: ElementScrollerOptions) => Scroller<Element>

/**
 * Lays an `AnchorList` out horizontally: pass `scroller={horizontal()}`.
 * When attaching, it makes the container scroll on the x axis, puts the rows
 * in a row and the header, list and footer side by side at their full width,
 * then creates `base` on the horizontal axis. Item sizes are widths; give the
 * container a width and a height.
 *
 * For lists that can be right-to-left, use `horizontal(rtlScroller)` with
 * `rtlScroller` from `@anchorlist/core/rtl`. The sticky overlay sticks to the
 * top only, so it scrolls away horizontally.
 *
 * @param base - The scroller to create. Default `elementScroller`.
 */
export function horizontal(base: ScrollerFactory = elementScroller): ScrollerFactory {
  return (e) => {
    e.element.style.overflowX = 'auto'
    e.list.style.flexDirection = 'row'
    Object.assign((e.content ?? e.list).style, { display: 'flex', width: 'max-content' })
    return base({ ...e, axis: HORIZONTAL })
  }
}
