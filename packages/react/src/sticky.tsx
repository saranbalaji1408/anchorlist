import type { VisibleRange } from '@anchorlist/core'
import { stickyState } from '@anchorlist/core/sticky'
import { useCallback, useEffect, useLayoutEffect as useLayout, useRef, useState, type ReactElement, type ReactNode } from 'react'

/** No layout effects without a DOM (React 18 warns about them during server rendering). */
const useLayoutEffect: typeof useLayout = typeof document < 'u' ? useLayout : useEffect

/** Props of {@link StickyItem}. */
export interface StickyItemProps<T> {
  /** The visible range passed to the `sticky` render prop. */
  range: VisibleRange
  /** The list's items (the same array as `AnchorList`'s `items`). */
  items: readonly T[]
  /**
   * Whether an item sticks to the viewport start once scrolled past (for
   * example a group header). Keep it stable (module scope or `useCallback`):
   * the walk back to the previous sticky item is remembered while it and
   * `items` stay the same.
   */
  isSticky: (item: T) => boolean
  /** Renders the stuck copy. Usually the list's `renderItem`. Give it a background. */
  renderItem: (item: T) => ReactNode
}

/**
 * Sticky items (for example group headers) for {@link AnchorList}: the last
 * sticky item scrolled past stays at the top of the viewport until the next
 * one pushes it out. Return it from the `sticky` render prop:
 *
 * ```tsx
 * <AnchorList
 *   items={rows}
 *   renderItem={renderRow}
 *   sticky={(range) => <StickyItem range={range} items={rows} isSticky={isHeader} renderItem={renderRow} />}
 * />
 * ```
 *
 * The rows themselves stay in normal flow and are never `position: sticky`;
 * this renders an `aria-hidden`, `inert` copy of the stuck item over them, so
 * screen readers read each header once, in its place, and keyboard focus never
 * lands in the copy. Being inert, the copy does not receive clicks either: they
 * reach whatever is under it (the header row itself while it is in view).
 */
export function StickyItem<T>({ range, items, isSticky, renderItem }: StickyItemProps<T>): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const update = useRef<() => void>(undefined)
  const [index, setIndex] = useState(-1)
  const sticky = useCallback((i: number) => i < items.length && isSticky(items[i]!), [items, isSticky])
  useLayoutEffect(() => {
    const el = ref.current!
    update.current = () => {
      // The `sticky` overlay sits directly inside the scroll container.
      const s = stickyState(el.parentElement!.parentElement!, range, sticky, el.offsetHeight)
      el.style.transform = `translateY(${s.offset}px)`
      setIndex(s.index)
    }
    update.current()
  })
  useLayoutEffect(() => {
    const el = ref.current!
    const sc = el.parentElement!.parentElement!
    // Set here rather than as a prop: React 18 and 19 disagree on the `inert` prop's value.
    el.setAttribute('inert', '')
    const onScroll = (): void => update.current!()
    // `scroll` cannot be cancelled, so the listener is passive anyway.
    sc.addEventListener('scroll', onScroll)
    return () => sc.removeEventListener('scroll', onScroll)
  }, [])
  const item = items[index]
  return (
    <div ref={ref} aria-hidden>
      {item !== undefined && renderItem(item)}
    </div>
  )
}
