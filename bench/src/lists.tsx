import { useVirtualizer } from '@tanstack/react-virtual'
import { AnchorList } from 'anchorlist'
import { memo, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { ESTIMATE, HEIGHT, WIDTH, type Item } from './data'

/** Render counts of the row content by item id, read by the runner. */
export const renders = new Map<string, number>()

/** The row content, shared by all three lists. */
function Content({ item }: { item: Item }): ReactNode {
  renders.set(item.id, (renders.get(item.id) ?? 0) + 1)
  return (
    <div data-key={item.id} style={{ height: item.height, boxSizing: 'border-box', borderBottom: '1px solid #ddd', padding: '0 8px' }}>
      {item.id}
    </div>
  )
}

/**
 * `?memo=1` wraps the row content in `React.memo`. Without it the content
 * re-renders exactly when its list re-renders it.
 */
const Bubble = new URLSearchParams(location.search).has('memo') ? memo(Content) : Content

export interface ListProps {
  items: Item[]
  /** Number of items prepended since mount (react-virtuoso's `firstItemIndex` needs it). */
  prepended: number
  /** Receives the scroll container once mounted. */
  onScroller: (el: HTMLElement) => void
}

const getKey = (item: Item): string => item.id
const renderItem = (item: Item): ReactNode => <Bubble item={item} />

/** anchorlist, configured as its README's chat example: `align="end"`. */
export function AnchorlistChat({ items, onScroller }: ListProps): ReactNode {
  return (
    <AnchorList
      items={items}
      getKey={getKey}
      renderItem={renderItem}
      align="end"
      estimateSize={() => ESTIMATE}
      style={{ height: HEIGHT, width: WIDTH }}
      ref={(h) => {
        if (h) onScroller(h.element)
      }}
    />
  )
}

/**
 * @tanstack/react-virtual, configured as its dynamic-size example plus its
 * chat options: `anchorTo: 'end'` (keeps the row at the viewport start when
 * items are added before it) and `followOnAppend`. It starts at the end with
 * `scrollToIndex(last, { align: 'end' })`.
 */
export function TanstackChat({ items, onScroller }: ListProps): ReactNode {
  const parent = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => parent.current,
    estimateSize: () => ESTIMATE,
    getItemKey: (i) => items[i]!.id,
    anchorTo: 'end',
    followOnAppend: true,
  })
  useLayoutEffect(() => {
    onScroller(parent.current!)
    v.scrollToIndex(items.length - 1, { align: 'end' })
    // Mount only.
  }, [])
  const rows = v.getVirtualItems()
  return (
    <div ref={parent} style={{ height: HEIGHT, width: WIDTH, overflowY: 'auto', contain: 'strict' }}>
      <div style={{ height: v.getTotalSize(), width: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${rows[0]?.start ?? 0}px)` }}>
          {rows.map((r) => (
            <div key={r.key} data-index={r.index} ref={v.measureElement}>
              <Bubble item={items[r.index]!} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Large enough that `firstItemIndex` never goes negative. */
const FIRST = 1_000_000

/**
 * react-virtuoso, configured as its chat / prepend examples: `firstItemIndex`
 * decreases by the number of prepended items, `initialTopMostItemIndex` opens
 * at the last item, `followOutput="auto"` follows appends while at the bottom,
 * `alignToBottom` and `computeItemKey`.
 */
export function VirtuosoChat({ items, prepended, onScroller }: ListProps): ReactNode {
  return (
    <Virtuoso
      style={{ height: HEIGHT, width: WIDTH }}
      data={items}
      firstItemIndex={FIRST - prepended}
      initialTopMostItemIndex={items.length - 1}
      followOutput="auto"
      alignToBottom
      computeItemKey={(_, item) => item.id}
      itemContent={(_, item) => <Bubble item={item} />}
      scrollerRef={(el) => el instanceof HTMLElement && onScroller(el)}
    />
  )
}

export const LISTS = { anchorlist: AnchorlistChat, tanstack: TanstackChat, virtuoso: VirtuosoChat }
export type Lib = keyof typeof LISTS
