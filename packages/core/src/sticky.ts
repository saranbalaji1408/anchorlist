import type { Axis } from './scroller'
import type { VisibleRange } from './types'

/** Output of {@link stickyState}. */
export interface StickyState {
  /** Index of the item to show stuck at the viewport start, or -1 for none. */
  readonly index: number
  /**
   * Main-axis offset to apply to the stuck copy, in px (0 or negative): the
   * next sticky item pushes it out of the viewport as it arrives.
   */
  readonly offset: number
}

/**
 * Sticky items for a virtual list (for example group headers): which item
 * sticks at the viewport start and how far the next sticky item pushes it.
 *
 * Rows stay in normal flow (they must not be `position: sticky`, because the
 * engine measures them). The adapter renders a copy of item `index` in an
 * overlay at the viewport start, shifted by `offset`, and recomputes on every
 * `scroll` event and after every commit. The stuck item is the last sticky
 * item whose row starts at or before the viewport start; rows that are not
 * mounted are above the viewport.
 *
 * @param scroller - The scroll container. Rows are found by the `data-index`
 *   attribute the engine writes, so a copy must not carry one.
 * @param range - The visible range (`getVisibleRange()`).
 * @param isSticky - Whether the item at an index is sticky.
 * @param size - Main-axis size of the stuck copy, in px.
 * @param axis - Only `start` is read. Default: vertical.
 */
export function stickyState(
  scroller: Element,
  range: VisibleRange,
  isSticky: (index: number) => boolean,
  size: number,
  axis: Pick<Axis, 'start'> = { start: 'top' },
): StickyState {
  const s = range.startIndex
  const e = range.endIndex
  if (e < s) return { index: -1, offset: 0 }
  const origin = scroller.getBoundingClientRect()[axis.start]
  /** Start of the mounted row `i` relative to the viewport start, else NaN (comparisons are false). */
  const at = (i: number): number => {
    const row = scroller.querySelector(`[data-index="${i}"]`)
    return row ? row.getBoundingClientRect()[axis.start] - origin : NaN
  }
  const before = (i: number): number => {
    while (i >= 0 && !isSticky(i)) i--
    return i
  }
  let index = before(s)
  let next = s + 1
  if (index >= 0 && at(index) > 0) {
    // The first visible row starts below the viewport start (a gap or the
    // list padding is showing): it pushes the previous sticky item.
    next = index
    index = before(index - 1)
  } else while (next <= e && !isSticky(next)) next++
  return { index, offset: index < 0 || next > e ? 0 : Math.min(0, at(next) - size || 0) }
}
