import type { Key, Virtualizer, VirtualizerOptions, VisibleRange } from '@anchorlist/core'
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react'
import { useAnchorList } from './useAnchorList'

/**
 * Imperative handle of {@link AnchorList}, available through `ref`. These are
 * the virtualizer methods of `@anchorlist/core`; see its API reference.
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
 * `maxCachedSizes` are read on mount only.
 */
export interface AnchorListProps<T> extends Omit<VirtualizerOptions, 'count' | 'getKey'> {
  /** The items, as an immutable snapshot: pass a new array instead of mutating it. */
  items: readonly T[]
  /** Unique, stable key of an item. The scroll position is anchored to keys. */
  getKey: (item: T) => Key
  /**
   * Renders an item. It receives no index, so a prepend re-renders no mounted
   * row. Mounted rows re-render only when their item or this function changes:
   * keep it stable (module scope or `useCallback`) to skip those renders.
   */
  renderItem: (item: T) => ReactNode
  /** Rendered above the rows, inside the scroll content. It may change size at any time. */
  header?: ReactNode
  /** Rendered below the rows, inside the scroll content. It may change size at any time. */
  footer?: ReactNode
  /**
   * Overlay pinned to the top of the viewport (for example a date pill),
   * rendered from the visible range. It re-renders only when that range changes.
   */
  sticky?: (range: VisibleRange) => ReactNode
  /** Class name of the scroll container. */
  className?: string
  /** Style of the scroll container. Give it a height; do not set a main-axis border. */
  style?: CSSProperties
  /** Class name of each row wrapper. Do not give rows margins; use `gap` instead. */
  rowClassName?: string
  /** Extra attributes for the scroll container (`id`, `aria-label`, `onKeyDown`, ...). */
  scrollerProps?: HTMLAttributes<HTMLDivElement>
}

type AnyRender = (item: never) => ReactNode

interface RowProps {
  v: Virtualizer
  k: Key
  item: unknown
  render: AnyRender
  className: string | undefined
}

/** `flow-root` keeps the children's margins inside the measured border box. */
const ROW: CSSProperties = { display: 'flow-root' }
const STICKY: CSSProperties = { position: 'sticky', top: 0, height: 0, zIndex: 1 }

/** One row. Its props never include the index, so prepends and trims skip it. */
const Row = memo(function Row({ v, k, item, render, className }: RowProps): ReactElement {
  const ref = useCallback((el: HTMLDivElement | null) => v.measureElement(el, k), [v, k])
  return (
    <div ref={ref} role="listitem" data-key={k} className={className} style={ROW}>
      {(render as (item: unknown) => ReactNode)(item)}
    </div>
  )
})

function Sticky({ v, render }: { v: Virtualizer; render: (range: VisibleRange) => ReactNode }): ReactElement {
  return <div style={STICKY}>{render(useSyncExternalStore(v.subscribe, v.getVisibleRange, v.getVisibleRange))}</div>
}

function AnchorListImpl<T>(props: AnchorListProps<T>, ref: ForwardedRef<AnchorListHandle>): ReactElement {
  const { items, getKey, renderItem, sticky } = props
  const element = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [v, plan] = useAnchorList(
    { ...props, count: items.length, getKey: (i) => getKey(items[i]!) },
    () => ({ element: element.current!, list: list.current!, content: content.current! }),
  )
  useImperativeHandle(ref, () => v, [v])
  const rows: ReactNode[] = []
  for (let i = plan.start; i <= plan.end; i++) {
    const item = items[i]!
    const k = getKey(item)
    rows.push(<Row key={k} k={k} v={v} item={item} render={renderItem as AnyRender} className={props.rowClassName} />)
  }
  return (
    <div
      {...props.scrollerProps}
      ref={element}
      className={props.className}
      style={{ overflowY: 'auto', overflowAnchor: 'none', ...props.style }}
    >
      {sticky && <Sticky v={v} render={sticky} />}
      <div ref={content}>
        {props.header}
        <div ref={list} role="list" style={{ display: 'flex', flexDirection: 'column', gap: props.gap }}>
          {rows}
        </div>
        {props.footer}
      </div>
    </div>
  )
}

/**
 * Virtual list with stable scroll anchoring. It renders only the rows near the
 * viewport and keeps the row being read in place while items are prepended,
 * appended, trimmed, removed or resized.
 *
 * - `align="end"` pins the list to the bottom (chat: it opens at the newest
 *   item and follows appends while pinned).
 * - `align="start"` (default) pins it to the top (feeds).
 *
 * The scroll container needs a fixed size (`style={{ height: 600 }}`). Rows
 * are rendered in a flex column; `data-index`, `aria-posinset` and
 * `aria-setsize` are written by the engine, and each row has `data-key`.
 * Rows never mount in the same commit as the scroll container.
 *
 * @example
 * ```tsx
 * <AnchorList
 *   style={{ height: 600 }}
 *   items={messages}
 *   getKey={(m) => m.id}
 *   align="end"
 *   hasMoreStart={hasOlder}
 *   onStartReached={loadOlder}
 *   renderItem={renderMessage}
 * />
 * ```
 */
export const AnchorList: <T>(props: AnchorListProps<T> & RefAttributes<AnchorListHandle>) => ReactElement | null =
  forwardRef(AnchorListImpl) as never
