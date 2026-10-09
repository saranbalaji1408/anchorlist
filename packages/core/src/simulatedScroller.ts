import type { Box, Scroller, ScrollerEvent } from './scroller'

/** A row in a {@link SimulatedScroller}. `size` is its true main-axis size. */
export interface SimulatedElement {
  /** True size, in px. Change it with {@link SimulatedScroller.resizeElement}. */
  size: number
}

/** Initial geometry of a {@link SimulatedScroller}. */
export interface SimulatedScrollerOptions {
  /** Viewport size. Default 600. */
  viewport?: number
  /** Cross-axis size. Default 400. */
  crossSize?: number
  /** Gap the simulated layout puts between rows (match the virtualizer's `gap`). Default 0. */
  gap?: number
  /** Size of the content before the list (a header). Default 0. */
  header?: number
  /** Size of the content after the list (a footer). Default 0. */
  footer?: number
  /** Simulate touch WebKit. Default false. */
  touchWebKit?: boolean
}

/**
 * A deterministic, DOM-free {@link Scroller}: one scroll container with a
 * header, a list of rows and a footer, a manual clock, and browser-like event
 * timing. Use it to run the virtualizer in Node.
 *
 * Events queue like a browser: offset changes queue a `'scroll'`, size changes
 * of observed rows or of the viewport queue a `'resize'`, and both are
 * delivered by {@link SimulatedScroller.tick}.
 */
export interface SimulatedScroller extends Scroller<SimulatedElement> {
  /** Sets the rendered rows in DOM order. */
  setRows(rows: readonly SimulatedElement[]): void
  /** Changes the true size of a row and queues a resize if it is observed. */
  resizeElement(el: SimulatedElement, size: number): void
  /** Changes the header size (queues a resize). */
  setHeader(size: number): void
  /** Changes the viewport and optionally the cross size (queues a resize). */
  resizeViewport(viewport: number, crossSize?: number): void
  /** User scroll to `offset` (clamped), with an `'input'` event first. */
  userScroll(offset: number): void
  /** Simulates a rubber-band overscroll of `px` beyond the current edge (0 ends it). */
  setOverscroll(px: number): void
  /** Starts or ends a touch. */
  touch(active: boolean): void
  /** Dispatches `'scrollend'`. */
  scrollEnd(): void
  /** Delivers queued scroll and resize events, runs frame callbacks, then advances the clock by 16 ms. */
  tick(): void
  /** Advances the clock, running due timeouts in order. */
  advance(ms: number): void
  /** Current visual translation of the content wrapper. */
  readonly translation: number
  /** Current spacer sizes `[before, after]`. */
  readonly spacers: readonly [number, number]
  /** Content-space start of a rendered row, or `undefined` when it is not rendered. */
  positionOf(el: SimulatedElement): number | undefined
}

/** Creates a {@link SimulatedScroller}. */
export function simulatedScroller(options: SimulatedScrollerOptions = {}): SimulatedScroller {
  let viewport = options.viewport ?? 600
  let cross = options.crossSize ?? 400
  const gap = options.gap ?? 0
  let header = options.header ?? 0
  const footer = options.footer ?? 0
  let rows: readonly SimulatedElement[] = []
  let before = 0
  let after = 0
  let raw = 0
  let over = 0
  let shift = 0
  let time = 0
  let scrollQueued = false
  let resizeQueued = false
  let handler: ((e: ScrollerEvent) => void) | undefined
  const observed = new Set<SimulatedElement>()
  let frames: Array<() => void> = []
  let timers: Array<{ at: number; cb: () => void; id: number }> = []
  let timerId = 0

  const listSize = (): number => {
    let s = before + after
    rows.forEach((r, i) => (s += r.size + (i ? gap : 0)))
    return s
  }
  const scrollSize = (): number => Math.max(viewport, header + listSize() + footer)
  const max = (): number => scrollSize() - viewport
  const reclamp = (): void => {
    const c = Math.min(Math.max(raw, 0), max())
    if (c !== raw) {
      raw = c
      scrollQueued = true
    }
  }
  const emit = (e: ScrollerEvent): void => handler?.(e)
  const positionOf = (el: SimulatedElement): number | undefined => {
    let p = header + before
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!
      if (r === el) return p
      p += r.size + gap
    }
    return undefined
  }

  const sim: SimulatedScroller = {
    offset: () => raw + over,
    setOffset(v) {
      const prev = raw
      raw = Math.min(Math.max(v, 0), max())
      over = 0
      if (raw !== prev) scrollQueued = true
    },
    viewport: () => viewport,
    crossSize: () => cross,
    scrollSize,
    overscrolled: () => over,
    measure(el): Box {
      const p = positionOf(el)
      return { start: (p ?? 0) - raw - over + shift, size: el.size }
    },
    listStart: () => header - raw - over + shift,
    setSpacers(b, a) {
      before = b
      after = a
      reclamp()
    },
    translate(px) {
      shift = px
    },
    setIndex() {},
    observe: (el) => void observed.add(el),
    unobserve: (el) => void observed.delete(el),
    listen(h) {
      handler = h
      return () => {
        handler = undefined
      }
    },
    now: () => time,
    frame(cb) {
      frames.push(cb)
      return () => {
        frames = frames.filter((f) => f !== cb)
      }
    },
    timeout(cb, ms) {
      const id = ++timerId
      timers.push({ at: time + ms, cb, id })
      return () => {
        timers = timers.filter((t) => t.id !== id)
      }
    },
    touchWebKit: options.touchWebKit ?? false,

    setRows(next) {
      rows = next
      reclamp()
    },
    resizeElement(el, size) {
      if (el.size === size) return
      el.size = size
      if (observed.has(el)) resizeQueued = true
      reclamp()
    },
    setHeader(size) {
      header = size
      resizeQueued = true
      reclamp()
    },
    resizeViewport(v, c = cross) {
      viewport = v
      cross = c
      resizeQueued = true
      reclamp()
    },
    userScroll(offset) {
      emit('input')
      const prev = raw
      raw = Math.min(Math.max(offset, 0), max())
      if (raw !== prev) scrollQueued = true
    },
    setOverscroll(px) {
      over = px
      scrollQueued = true
    },
    touch(active) {
      emit(active ? 'touchstart' : 'touchend')
    },
    scrollEnd: () => emit('scrollend'),
    tick() {
      for (let guard = 0; guard < 10 && (scrollQueued || resizeQueued); guard++) {
        if (scrollQueued) {
          scrollQueued = false
          emit('scroll')
        }
        if (resizeQueued) {
          resizeQueued = false
          emit('resize')
        }
      }
      const run = frames
      frames = []
      run.forEach((f) => f())
      sim.advance(16)
    },
    advance(ms) {
      const end = time + ms
      for (;;) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0]
        if (!due) break
        timers = timers.filter((t) => t !== due)
        time = Math.max(time, due.at)
        due.cb()
      }
      time = end
    },
    get translation() {
      return shift
    },
    get spacers() {
      return [before, after] as const
    },
    positionOf,
  }
  return sim
}
