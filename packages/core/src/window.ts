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
 * `overflow-anchor: none` on `content` while attached (restored on detach), so
 * the browser's own scroll anchoring never picks a row.
 */
export function windowScroller({ list, content = list, axis: ax = VERTICAL, scrollMargin: m = 0 }: WindowScrollerOptions): Scroller<Element> {
  const root = document.documentElement
  // The document element scrolls the window in standards mode; its client size is the viewport.
  const base = elementScroller({ element: root, list, content, axis: ax })
  const at = (e: Element): number => e.getBoundingClientRect()[ax.start] - m
  const style = content.style
  return {
    ...base,
    viewport: () => root[ax.client] - m,
    scrollSize: () => root[ax.scrollSize] - m,
    measure(e) {
      return { start: at(e), size: e.getBoundingClientRect()[ax.size] }
    },
    listStart: () => at(list),
    // Wheel and keys outside the list and the page scrollbar scroll the window too.
    inputTarget: window,
    listen(handler) {
      // Touch and wheel events bubble to the document element; scroll and resize are dispatched on the window.
      const off = base.listen(handler)
      // The base observes the scroll element, here the document element, which resizes on any
      // page change and would remeasure every row. Rows, list and content stay observed and the
      // window reports its own resize; the document element only reports a change that moves
      // the list (page content above it) or resizes the page outside `content`.
      base.unobserve(root)
      const place = (): string => [at(list) + root[ax.offset], root[ax.scrollSize] - content.getBoundingClientRect()[ax.size]] + ''
      let last = place()
      const ro = new ResizeObserver(() => last != (last = place()) && handler('resize'))
      ro.observe(root)
      const fn = (e: Event): void => handler(e.type as ScrollerEvent)
      const types = ['scroll', 'resize']
      types.forEach((t) => window.addEventListener(t, fn, { passive: true }))
      // The document keeps browser scroll anchoring; it must not pick rows, which the engine
      // anchors. Listening spans attach to detach, so the app's own value comes back on detach.
      const anchor = style.overflowAnchor
      style.overflowAnchor = 'none'
      return () => {
        off()
        ro.disconnect()
        types.forEach((t) => window.removeEventListener(t, fn))
        style.overflowAnchor = anchor
      }
    },
  }
}
