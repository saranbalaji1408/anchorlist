/** Stable identity of an item. It must survive prepends, appends and trims. */
export type Key = string | number

/** One end of the list. `start` is the top (or left), `end` is the bottom (or right). */
export type Edge = 'start' | 'end'

/** Where an item lands in the viewport after `scrollToKey`. */
export type ItemAlign = 'start' | 'center' | 'end'

/** Inclusive index range. It is empty when `end < start`. */
export interface Range {
  /** First index (inclusive). */
  readonly start: number
  /** Last index (inclusive). */
  readonly end: number
}

/** Items intersecting the viewport, overscan excluded. */
export interface VisibleRange {
  /** First visible index, or 0 when nothing is visible. */
  readonly startIndex: number
  /** Last visible index, or -1 when nothing is visible. */
  readonly endIndex: number
  /** Key of the first visible item, or `null`. */
  readonly startKey: Key | null
  /** Key of the last visible item, or `null`. */
  readonly endKey: Key | null
}
