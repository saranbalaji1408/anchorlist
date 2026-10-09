/**
 * Events a {@link Scroller} reports to the virtualizer. DOM event names can be
 * passed through unchanged: `touchcancel` counts as `touchend`, and any other
 * name (`wheel`, `pointerdown`, `keydown`, ...) counts as `input`.
 */
export type ScrollerEvent =
  /** The scroll offset changed (programmatic or user). */
  | 'scroll'
  /** The viewport, the cross axis or an observed element changed size. */
  | 'resize'
  /** A touch started. Corrections are deferred on touch WebKit until scrolling is idle. */
  | 'touchstart'
  /** A touch ended. */
  | 'touchend'
  /** A touch was cancelled (same as `touchend`). */
  | 'touchcancel'
  /** Scrolling (including momentum) finished. */
  | 'scrollend'
  /** Direct user input. Cancels a pending `scrollToKey` lock. */
  | 'input'
  /** Same as `input`. */
  | 'wheel'
  /** Same as `input`. */
  | 'pointerdown'
  /** Same as `input`. */
  | 'keydown'

/** Main-axis position and size of an element. */
export interface Box {
  /** Start edge relative to the start of the viewport, in px. */
  readonly start: number
  /** Size along the main axis, in px. */
  readonly size: number
}

/**
 * Everything the virtualizer needs from its environment. The virtualizer is
 * 1-D: every value is along the main axis unless named `cross`.
 *
 * Implementations: {@link elementScroller} for a DOM element and
 * `simulatedScroller` for deterministic tests without a DOM.
 */
export interface Scroller<E = unknown> {
  /** Raw scroll offset. May be outside `[0, scrollSize - viewport]` while overscrolled. */
  offset(): number
  /** Writes the scroll offset. */
  setOffset(offset: number): void
  /** Viewport size (client size). */
  viewport(): number
  /** Viewport size on the cross axis. A change marks cached sizes stale. */
  crossSize(): number
  /** Total scrollable size (scroll size). */
  scrollSize(): number
  /** How far the offset is past either end (rubber-band), 0 when inside. */
  overscrolled(): number
  /** Main-axis box of a row element, relative to the viewport start (transforms included). */
  measure(el: E): Box
  /** Start of the list element relative to the viewport start (transforms included). */
  listStart(): number
  /** Sets the space before the first and after the last rendered row. */
  setSpacers(before: number, after: number): void
  /** Visually shifts the content wrapper by `px` (0 clears it). */
  translate(px: number): void
  /** Writes `data-index`, `aria-posinset` and `aria-setsize` (-1 when unknown) on a row. */
  setIndex(el: E, index: number, setSize: number): void
  /** Starts reporting size changes of `el` as `'resize'`. */
  observe(el: E): void
  /** Stops observing `el`. */
  unobserve(el: E): void
  /** Subscribes to events. Returns the unsubscribe function. */
  listen(handler: (event: ScrollerEvent) => void): () => void
  /** Monotonic time in ms. */
  now(): number
  /** Runs `cb` on the next animation frame. Returns a cancel function. Never used for scroll corrections. */
  frame(cb: () => void): () => void
  /** Runs `cb` after `ms`. Returns a cancel function. */
  timeout(cb: () => void, ms: number): () => void
  /** True on touch WebKit (iOS, iPadOS), where writing the offset during momentum stops the fling. */
  readonly touchWebKit: boolean
}

/** DOM property names for one scroll axis, so the maths stays 1-D. */
export interface Axis {
  /** Scroll offset property, e.g. `scrollTop`. */
  readonly offset: 'scrollTop' | 'scrollLeft'
  /** Viewport size property, e.g. `clientHeight`. */
  readonly client: 'clientHeight' | 'clientWidth'
  /** Cross-axis viewport size property. */
  readonly cross: 'clientWidth' | 'clientHeight'
  /** Scroll size property, e.g. `scrollHeight`. */
  readonly scrollSize: 'scrollHeight' | 'scrollWidth'
  /** `DOMRect` start property. */
  readonly start: 'top' | 'left'
  /** `DOMRect` size property. */
  readonly size: 'height' | 'width'
  /** Padding style at the start edge. */
  readonly padStart: 'paddingTop' | 'paddingLeft'
  /** Padding style at the end edge. */
  readonly padEnd: 'paddingBottom' | 'paddingRight'
  /** Transform function for the main axis. */
  readonly translate: 'translateY' | 'translateX'
}

/** The vertical axis. */
export const VERTICAL: Axis = {
  offset: 'scrollTop',
  client: 'clientHeight',
  cross: 'clientWidth',
  scrollSize: 'scrollHeight',
  start: 'top',
  size: 'height',
  padStart: 'paddingTop',
  padEnd: 'paddingBottom',
  translate: 'translateY',
}

/** The horizontal (left-to-right) axis. */
export const HORIZONTAL: Axis = {
  offset: 'scrollLeft',
  client: 'clientWidth',
  cross: 'clientHeight',
  scrollSize: 'scrollWidth',
  start: 'left',
  size: 'width',
  padStart: 'paddingLeft',
  padEnd: 'paddingRight',
  translate: 'translateX',
}

/** Elements used by {@link elementScroller}. */
export interface ElementScrollerOptions {
  /** The scroll container (`overflow: auto`, `overflow-anchor: none`). */
  element: HTMLElement
  /**
   * The element that directly contains the rows. Its main-axis padding is
   * owned by the virtualizer (use `paddingStart`/`paddingEnd`). Give it and the
   * scroll container no main-axis border.
   */
  list: HTMLElement
  /** One wrapper around header, list and footer that receives deferred corrections. Defaults to `list`. */
  content?: HTMLElement
  /** Scroll axis: {@link VERTICAL} (default) or {@link HORIZONTAL}. */
  axis?: Axis
}

/** True on touch WebKit: iPhone, iPod, and iPad (which may report a Mac user agent). */
export function isTouchWebKit(nav?: { userAgent: string; maxTouchPoints?: number }): boolean {
  const ua = nav ? nav.userAgent : ''
  return /iP(hone|od|ad)/.test(ua) || (/Mac/.test(ua) && nav!.maxTouchPoints! > 1)
}

/** Creates a {@link Scroller} for a DOM scroll container. */
export function elementScroller({ element: el, list, content = list, axis: ax = VERTICAL }: ElementScrollerOptions): Scroller<Element> {
  const style = list.style
  let ro: ResizeObserver | undefined
  // Borders are not compensated: give the scroller and the list no border on the main axis.
  const origin = (): number => el.getBoundingClientRect()[ax.start]
  const offset = (): number => el[ax.offset]
  const max = (): number => el[ax.scrollSize] - el[ax.client]

  return {
    offset,
    setOffset(v) {
      el[ax.offset] = v
    },
    viewport: () => el[ax.client],
    crossSize: () => el[ax.cross],
    scrollSize: () => el[ax.scrollSize],
    overscrolled: () => Math.min(offset(), 0) || Math.max(offset() - max(), 0),
    measure(e) {
      const r = e.getBoundingClientRect()
      return { start: r[ax.start] - origin(), size: r[ax.size] }
    },
    listStart: () => list.getBoundingClientRect()[ax.start] - origin(),
    setSpacers(b, a) {
      style[ax.padStart] = b + 'px'
      style[ax.padEnd] = a + 'px'
    },
    translate(px) {
      content.style.transform = px ? `${ax.translate}(${px}px)` : ''
    },
    setIndex(e, i, n) {
      e.setAttribute('data-index', '' + i)
      e.setAttribute('aria-posinset', '' + (i + 1))
      e.setAttribute('aria-setsize', '' + n)
    },
    observe: (e) => ro?.observe(e),
    unobserve: (e) => ro?.unobserve(e),
    listen(handler) {
      // A user scroll by any means (keys, scrollbar) also cancels a lock through `scroll`.
      const types = 'scroll touchstart touchend touchcancel scrollend wheel'.split(' ')
      const fn = (e: Event): void => handler(e.type as ScrollerEvent)
      types.forEach((t) => el.addEventListener(t, fn, { passive: true }))
      ro = new ResizeObserver(() => handler('resize'))
      ;[el, content, list].forEach((e) => ro!.observe(e))
      return () => {
        types.forEach((t) => el.removeEventListener(t, fn))
        ro!.disconnect()
      }
    },
    now: () => performance.now(),
    frame(cb) {
      const id = requestAnimationFrame(cb)
      return () => cancelAnimationFrame(id)
    },
    timeout(cb, ms) {
      const id = setTimeout(cb, ms)
      return () => clearTimeout(id)
    },
    touchWebKit: isTouchWebKit(navigator),
  }
}
