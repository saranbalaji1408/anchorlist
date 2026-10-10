/** Package version. */
export const VERSION: string = '0.0.0'

export type { Edge, ItemAlign, Key, Range, VisibleRange } from './types'
export { createVirtualizer } from './virtualizer'
export type {
  FollowContext,
  ItemRect,
  Plan,
  ScrollToOptions,
  Snapshot,
  Virtualizer,
  VirtualizerHost,
  VirtualizerOptions,
} from './virtualizer'
export { elementScroller, HORIZONTAL, isTouchWebKit, VERTICAL } from './scroller'
export type { Axis, Box, ElementScrollerOptions, Scroller, ScrollerEvent } from './scroller'
export { simulatedScroller } from './simulatedScroller'
export type { SimulatedElement, SimulatedScroller, SimulatedScrollerOptions } from './simulatedScroller'
export { createSizeIndex, spliceSizes } from './sizeIndex'
export type { SizeIndex } from './sizeIndex'
export { createKeyMap, NO_CHANGE } from './keyMap'
export type { KeyDiff, KeyMap } from './keyMap'
export { createSizeCache } from './sizeCache'
export type { SizeCache } from './sizeCache'
