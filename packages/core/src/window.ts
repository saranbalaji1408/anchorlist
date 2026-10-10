import { elementScroller, VERTICAL, type Axis, type Scroller, type ScrollerEvent } from './scroller'

/** Options of {@link windowScroller}. */
export interface WindowScrollerOptions {
  /**
   * The element that directly contains the rows. Its main-axis padding is
   * owned by the virtualizer (use `paddingStart`/`paddingEnd`).
   */
  list: HTMLElement
  /** One wrapper around header, list and footer that receives deferred corrections. Defaults to `list`. */
  content?: HTMLElement
  /** Scroll axis: {@link VERTICAL} (default) or `HORIZONTAL`. */
  axis?: Axis
  /**
   * Size in px of fixed or sticky UI covering the start of the window (for
   * example an app bar), like CSS `scroll-padding`. The viewport starts below
   * it: rows are anchored and `scrollToKey` aligns relative to its edge, and
   * the visible range excludes what it covers. Default 0. Read at creation.
   * The list's own position in the page is measured: do not pass its offset.
   */
  scrollMargin?: number
}

/**
 * Creates a {@link Scroller} for a list that scrolls with the page instead of
 * its own container. Content outside the list (page header, footer) behaves
 * like the list's header and footer: the scroll range is the whole document.
 * Accepts `ElementScrollerOptions` too (`element` is ignored), so it can be
 * passed wherever an `elementScroller` factory is expected. Sets
 * `overflow-anchor: none` on `content`, so the browser's own scroll anchoring
 * never picks a row.
 */
export function windowScroller({ list, content = list, axis: ax = VERTICAL, scrollMargin: m = 0 }: WindowScrollerOptions): Scroller<Element> {
  const root = document.documentElement
  // The document element scrolls the window in standards mode; its client size is the viewport.
  const base = elementScroller({ element: root, list, content, axis: ax })
  const at = (e: Element): number => e.getBoundingClientRect()[ax.start] - m
  // The document keeps browser scroll anchoring; it must not pick rows, which the engine anchors.
  content.style.overflowAnchor = 'none'
  return {
    ...base,
    viewport: () => root[ax.client] - m,
    scrollSize: () => root[ax.scrollSize] - m,
    measure(e) {
      return { start: at(e), size: e.getBoundingClientRect()[ax.size] }
    },
    listStart: () => at(list),
    listen(handler) {
      // Touch and wheel events bubble to the document element; scroll and resize are dispatched on the window.
      const off = base.listen(handler)
      const fn = (e: Event): void => handler(e.type as ScrollerEvent)
      const types = ['scroll', 'resize']
      types.forEach((t) => window.addEventListener(t, fn, { passive: true }))
      return () => {
        off()
        types.forEach((t) => window.removeEventListener(t, fn))
      }
    },
  }
}
