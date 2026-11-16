import type { Lanes } from '@anchorlist/core/lanes'
import type { AnchorListProps } from './types.js'

/** Props of `LanesList`: those of `AnchorList`, plus the lane layout. */
export interface LanesListProps<T> extends AnchorListProps<T> {
  /**
   * The lane layout from `@anchorlist/core/lanes`: `grid({ lanes: 3 })` or
   * `masonry({ lanes: 3, gap: 8 })`. Create it once per list; it is read on mount.
   */
  lanes: Lanes
}
