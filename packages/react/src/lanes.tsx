import { elementScroller, type VirtualizerOptions } from '@anchorlist/core'
import type { Lanes } from '@anchorlist/core/lanes'
import { forwardRef, type ForwardedRef, type ReactElement, type RefAttributes } from 'react'
import { AnchorList, type AnchorListHandle, type AnchorListProps } from './AnchorList'
import { useLayoutEffect } from './effect'

/** Props of {@link LanesList}: those of `AnchorList`, plus the lane layout. */
export interface LanesListProps<T> extends AnchorListProps<T> {
  /**
   * The lane layout from `@anchorlist/core/lanes`: `grid({ lanes: 3 })` or
   * `masonry({ lanes: 3, gap: 8 })`. Create it once per list (for example with
   * `useState`); it is read on mount.
   */
  lanes: Lanes
}

/** Hands the committed items to the lanes. Rendered before the list, so its layout effect runs first. */
function Sync({ lanes, options }: { lanes: Lanes; options: VirtualizerOptions }): null {
  useLayoutEffect(() => lanes.sync(options))
  return null
}

function LanesListImpl<T>(props: LanesListProps<T>, ref: ForwardedRef<AnchorListHandle>): ReactElement {
  const { lanes, items, getKey, scroller = elementScroller } = props
  const options: VirtualizerOptions = { ...props, count: items.length, getKey: (i) => getKey(items[i]!) }
  const converted = lanes.options(options)
  return (
    <>
      <Sync lanes={lanes} options={options} />
      <AnchorList<T>
        ref={ref}
        {...props}
        gap={0}
        paddingStart={0}
        paddingEnd={0}
        estimateSize={converted.estimateSize!}
        // AnchorList leaves overflow to a custom scroller; the default one scrolls the container.
        style={props.scroller ? props.style : { overflowY: 'auto', ...props.style }}
        scroller={(e) => {
          // Items are positioned absolutely inside the list.
          e.list.style.position = 'relative'
          return lanes.scroller(scroller(e))
        }}
      />
    </>
  )
}

/**
 * `AnchorList` with items laid out in lanes (a grid or masonry), positioned
 * absolutely. It takes every `AnchorList` prop plus `lanes`; the lanes own
 * the gap, and `paddingStart` / `paddingEnd` are not used. A custom `scroller`
 * (for example `horizontal()` with `grid({ lanes, horizontal: true })`, or
 * `windowScroller`) is wrapped by the lanes. Keep `overscan` (default 400)
 * at least as large as the largest item: masonry items sit up to one item
 * away from their position on the engine's axis, and a grid row at the edge of
 * the overscan may be rendered in part.
 *
 * @example
 * ```tsx
 * const [lanes] = useState(() => masonry({ lanes: 3, gap: 8 }))
 * <LanesList style={{ height: 600 }} items={photos} getKey={(p) => p.id} renderItem={renderPhoto} lanes={lanes} />
 * ```
 */
export const LanesList: <T>(props: LanesListProps<T> & RefAttributes<AnchorListHandle>) => ReactElement | null =
  forwardRef(LanesListImpl) as never
