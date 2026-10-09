import { createKeyMap, NO_CHANGE, REBUILD, type KeyDiff } from './keyMap'
import type { Scroller, ScrollerEvent } from './scroller'
import { createSizeCache } from './sizeCache'
import { createSizeIndex } from './sizeIndex'
import type { Edge, ItemAlign, Key, Range, VisibleRange } from './types'

/** Passed to a `follow` function when items are added at the pinned edge. */
export interface FollowContext {
  /** Whether the list was pinned to its `align` edge before the change. */
  readonly atEdge: boolean
  /** Number of items added at the pinned edge (appended for `end`, prepended for `start`). */
  readonly added: number
  /** New item count. */
  readonly count: number
}

/**
 * Serializable scroll position, from {@link Virtualizer.getSnapshot}. Pass it
 * back as `initialSnapshot` to restore the position.
 */
export interface Snapshot {
  /** Anchor item key, or `null` for an empty list. */
  readonly key: Key | null
  /** Anchor item index, used when the key no longer exists. */
  readonly index: number
  /** Position of the anchor's `align` edge relative to the viewport start, in px. */
  readonly delta: number
  /** True when the list was pinned to its `align` edge. */
  readonly pinned: boolean
}

/**
 * Options of {@link createVirtualizer}. Pass the current options to `plan()` on
 * every render; they take effect when that plan is committed. `align`,
 * `initialSnapshot` and `maxCachedSizes` are read once, at creation.
 */
export interface VirtualizerOptions {
  /** Number of items. */
  count: number
  /** Stable key of the item at `index`. Keys must be unique. */
  getKey: (index: number) => Key
  /**
   * Size estimate for an unmeasured item. Default: 48, replaced at idle by the
   * average measured size when that drifts by more than 10%.
   */
  estimateSize?: (index: number) => number
  /**
   * The edge the list is pinned to. `'end'` for chat (newest at the bottom),
   * `'start'` for feeds. Anchoring uses the anchor item's edge on this side and
   * `follow` applies to items added at this edge. Default `'start'`. Read at creation.
   */
  align?: Edge
  /** Extra px rendered before and after the viewport. Default 400. */
  overscan?: number
  /** Gap between items, in px. The host must lay rows out with the same gap. Default 0. */
  gap?: number
  /** Space before the first item, in px. Default 0. */
  paddingStart?: number
  /** Space after the last item, in px. Default 0. */
  paddingEnd?: number
  /** More items can be loaded before the first one. */
  hasMoreStart?: boolean
  /** More items can be loaded after the last one. */
  hasMoreEnd?: boolean
  /** Distance from the start, in px, below which `onStartReached` fires. Default 300. */
  startThreshold?: number
  /** Distance from the end, in px, below which `onEndReached` fires. Default 300. */
  endThreshold?: number
  /**
   * Fires when within `startThreshold` of the start and `hasMoreStart` is set:
   * once on entering that zone, and again when the first item changes while
   * inside it. Re-arms on leaving the zone. Suppressed while overscrolled.
   */
  onStartReached?: () => void
  /** Like `onStartReached`, for the end, `endThreshold`, `hasMoreEnd` and the last item. */
  onEndReached?: () => void
  /** Tolerance in px for "at edge". Default 2. */
  atEdgeThreshold?: number
  /**
   * Whether to stay pinned when items are added at the `align` edge. Default:
   * follow only if already pinned. `true` (or a function returning true)
   * forces a jump to the edge, e.g. for the user's own message.
   */
  follow?: boolean | ((context: FollowContext) => boolean)
  /** Called when the visible range changes. */
  onRangeChange?: (range: VisibleRange) => void
  /** Called when "at the `align` edge" changes. */
  onAtEdgeChange?: (atEdge: boolean) => void
  /** Scroll position to restore on mount. Read at creation only. */
  initialSnapshot?: Snapshot
  /** Maximum number of cached sizes; the least recently measured are evicted. Default unlimited. Read at creation only. */
  maxCachedSizes?: number
}

/**
 * The framework adapter. `render(sync)` asks the host to re-render: call
 * `plan()`, update the DOM, then call `commit()` before the next paint.
 */
export interface VirtualizerHost {
  /**
   * Requests a re-render. `sync: true` means the host must render and commit
   * before `render` returns (e.g. React `flushSync`). `sync: false` is used
   * from inside `commit()` and from resize callbacks; a normal state update
   * is enough there (inside `commit()` it must still flush before paint).
   */
  render(sync: boolean): void
}

/** Options of {@link Virtualizer.scrollToKey}. */
export interface ScrollToOptions {
  /** Where the item lands in the viewport. Default `'start'`. */
  align?: ItemAlign
  /** Extra px added to the final offset (positive scrolls further). Default 0. */
  offset?: number
}

/** Position of an item in content space (from the start of the scroll content). */
export interface ItemRect {
  /** Start offset, in px. */
  readonly start: number
  /** Size, in px. */
  readonly size: number
  /** False while the size is an estimate or stale after a cross-axis resize. */
  readonly measured: boolean
}

/** The output of {@link Virtualizer.plan}: the range to render and the options it was planned for. */
export interface Plan extends Range {
  /** The options passed to `plan()`. */
  readonly options: VirtualizerOptions
}

/** A virtualizer instance. See `API.md` for the host contract. */
export interface Virtualizer {
  /**
   * Returns the range to render for `options` (default: the committed
   * options). Pure: it reads state but never mutates it, so it is safe in a
   * render phase that may be discarded or repeated. Empty until `attach()`.
   */
  plan(options?: VirtualizerOptions): Plan
  /**
   * Applies the plan whose rows are now in the DOM: diffs keys, measures,
   * writes spacers and attributes, and restores the anchor. Call after the DOM
   * update and before paint, with the plan object that was rendered. May
   * call `host.render(false)` when the range must change.
   */
  commit(plan: Plan): void
  /**
   * Connects the scroller (replacing a previous one) and runs the reconcile
   * loop. Call once the scroll container, list and content elements exist,
   * before the first `commit()` that renders rows.
   */
  attach<E>(scroller: Scroller<E>): void
  /**
   * Registers a row element: `measureElement(el, key)` on mount,
   * `measureElement(null, key)` on unmount. The element's main-axis border-box
   * size is its item size (margins are not measured).
   */
  measureElement(el: unknown, key: Key): void
  /** Detaches listeners and timers. The instance must not be used afterwards. */
  destroy(): void
  /** Scrolls to the item with `key` and keeps it there while sizes settle. Returns false for an unknown key. */
  scrollToKey(key: Key, options?: ScrollToOptions): boolean
  /** {@link Virtualizer.scrollToKey} by index. Returns false when out of range. */
  scrollToIndex(index: number, options?: ScrollToOptions): boolean
  /** Scrolls to an edge (default: `align`) and pins there unless `hasMore` is set for that edge. */
  scrollToEdge(edge?: Edge): void
  /** True when within `atEdgeThreshold` of `edge` (default: `align`). */
  isAtEdge(edge?: Edge): boolean
  /** Items intersecting the viewport. Same object until it changes. */
  getVisibleRange(): VisibleRange
  /** Content-space rect of an item, or `null` for an unknown key. */
  getItemRect(key: Key): ItemRect | null
  /** Total list size including padding and gaps. */
  getTotalSize(): number
  /** Index of `key`, or -1. */
  indexOf(key: Key): number
  /** Current scroll position, for restoring later. */
  getSnapshot(): Snapshot
  /** Notifies `listener` after the visible range or the at-edge state changes. Returns unsubscribe. */
  subscribe(listener: () => void): () => void
}

interface Point {
  k: Key
  d: number
}
/** Pinned to an edge. */
interface EdgeMode {
  t: 0
  e: Edge
}
/** Anchored to an item's `align` edge, `d` px from the viewport start. */
interface ItemMode extends Point {
  t: 1
  /** Index, for recapture when the key and every fallback are gone. */
  i: number
  /** Fallbacks: after, before, after, before. */
  f: Point[]
}
/** Scrolling to an item; locked until sizes settle. */
interface TargetMode {
  t: 2
  k: Key
  a: ItemAlign
  o: number
  /** Start time. */
  s: number
  /** Consecutive frames without a resize. */
  q: number
}
type Mode = EdgeMode | ItemMode | TargetMode


/**
 * Corrections at or below this many px are not written. The anchor keeps its
 * intended delta, so the residual stays within ±EPSILON and one change moves
 * content by at most 2 × EPSILON = 0.5 px.
 */
const EPSILON = 0.25
/** No scroll event for this long means momentum ended. */
const IDLE_MS = 120
/** Delay for idle work: key validation and estimate refresh. */
const BACKGROUND_MS = 300
const TARGET_FRAMES = 2
const TARGET_MAX_MS = 500
const MAX_PASSES = 8

const EMPTY: Range = { start: 0, end: -1 }
const ALIGN = { start: 0, center: 0.5, end: 1 }
const NO_VISIBLE: VisibleRange = { startIndex: 0, endIndex: -1, startKey: null, endKey: null }

/**
 * Creates a virtualizer: windowing with stable, key-based scroll anchoring for
 * lists pinned to either edge. The host renders `plan()` and calls `commit()`;
 * the virtualizer owns every scroll offset write.
 */
export function createVirtualizer(options: VirtualizerOptions, host: VirtualizerHost): Virtualizer {
  let opts = options
  const align: Edge = options.align ?? 'start'
  const atEnd = align === 'end'
  const keys = createKeyMap()
  const cache = createSizeCache(options.maxCachedSizes)
  const idx = createSizeIndex()
  const rows = new Map<Key, unknown>()
  const listeners = new Set<() => void>()
  /** Timers by slot: 0 idle commit, 1 background, 2 target lock frame. */
  const timers: Array<(() => void) | undefined> = []
  /** Pinned to the `align` edge. Shared, so `mode === EDGE` means pinned. */
  const EDGE: EdgeMode = { t: 0, e: align }

  const snap = options.initialSnapshot
  let mode: Mode = snap && snap.key !== null && !snap.pinned ? { t: 1, k: snap.key, d: snap.delta, i: snap.index, f: [] } : EDGE

  let sc: Scroller | null = null
  let committed: Range = EMPTY
  let viewport = 0
  let cross = 0
  /** List start in content space. */
  let listStart = 0
  /** Deferred correction held in a transform (px). */
  let pending = 0
  let touching = false
  let lastScrollAt = -Infinity
  /** Effective offset after our last write or event; a scroll event that lands here is ours. */
  let lastEff = 0
  /** Scroll size after the last restore, to recognise offset clamps when content shrinks. */
  let lastSize = 0
  let passes = 0
  let resized = false
  /** Key of the edge item when `onStartReached` / `onEndReached` last fired, while inside the zone. */
  let startLatch: Key | undefined
  let endLatch: Key | undefined
  let atEdgeState: boolean | undefined
  let visible = NO_VISIBLE
  let estimate = 48
  let needBackground = false

  const later = (slot: number, fn?: () => void, ms?: number): void => {
    timers[slot]?.()
    timers[slot] = fn && sc ? (ms ? sc.timeout(fn, ms) : sc.frame(fn)) : undefined
  }
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)
  /** The `hasMore` option of the pinned edge. */
  const more = atEnd ? 'hasMoreEnd' : 'hasMoreStart'
  const eff = (): number => (sc ? sc.offset() + pending : 0)
  const maxScroll = (): number => (sc ? Math.max(0, sc.scrollSize() - viewport) : 0)
  const sizeFor = (o: VirtualizerOptions, i: number): number =>
    cache.get(o.getKey(i)) ?? o.estimateSize?.(i) ?? estimate

  /** Items intersecting the viewport grown by `over` px on each side, at the current offset. */
  const range = (over: number): Range => {
    const v = eff() - listStart
    const start = idx.findIndexAtOffset(v - over)
    return idx.count ? { start, end: idx.findIndexAtOffset(v + viewport + over) } : EMPTY
  }
  const rangeNow = (): Range => range(opts.overscan ?? 400)

  /** Content-space start and size of item `i`: from the DOM when mounted, else from the index. */
  const box = (i: number): [number, number] => {
    const row = rows.get(opts.getKey(i))
    if (!row) return [listStart + idx.offsetOf(i), idx.size(i)]
    const b = sc!.measure(row)
    return [b.start + eff(), b.size]
  }
  const edgeOf = (i: number): number => {
    const [s, z] = box(i)
    return atEnd ? s + z : s
  }

  // ------------------------------------------------------------------ anchor

  /** Anchors the first item reaching into the viewport, with two fallbacks on each side. */
  const capture = (): ItemMode | null => {
    const n = idx.count
    const e = eff()
    // Without a scroller nothing is mounted, so this uses model positions.
    if (!n) return null
    let i = idx.findIndexAtOffset(e - listStart)
    while (i < n - 1 && listStart + idx.offsetOf(i) + idx.size(i) <= e) i++
    const point = (j: number): Point => ({ k: opts.getKey(j), d: edgeOf(j) - e })
    return { t: 1, i, f: [i + 1, i - 1, i + 2, i - 2].filter((j) => j >= 0 && j < n).map(point), ...point(i) }
  }
  const recapture = (): void => {
    mode = capture() ?? mode
  }
  /** Moves every point of an item anchor by `by` px. */
  const shift = (m: Mode, by: number): void => {
    if (m.t === 1) [m, ...m.f].forEach((p) => (p.d += by))
  }

  // ------------------------------------------------------------- scrolling

  /** Touch WebKit during touch or momentum, and any rubber-band overscroll. */
  const defer = (): boolean =>
    sc!.overscrolled() !== 0 || (sc!.touchWebKit && (touching || sc!.now() - lastScrollAt < IDLE_MS))

  const write = (v: number): void => {
    if (pending) sc!.translate((pending = 0))
    sc!.setOffset(v)
    lastEff = eff()
  }
  const commitPending = (force: boolean): void => {
    // Only reachable with a scroller (events and timers stop on destroy).
    if (pending && !touching) {
      if (force || !defer()) write(sc!.offset() + pending)
      else scheduleIdle()
    }
  }
  const scheduleIdle = (): void => later(0, () => commitPending(false), IDLE_MS)

  /** Moves the effective offset, deferring into a transform when a write would interrupt the user. */
  const scrollTo = (desired: number): void => {
    const target = clamp(desired, 0, maxScroll())
    if (Math.abs(target - eff()) <= EPSILON) return
    if (!defer()) return write(target)
    pending = target - sc!.offset()
    sc!.translate(-pending)
    scheduleIdle()
    lastEff = eff()
  }

  const restore = (): void => {
    const m = mode
    if (!m.t) return scrollTo(m.e === 'end' ? Infinity : 0)
    const n = idx.count
    if (m.t === 2) {
      const j = keys.indexOf(m.k)
      if (j < 0) return recapture()
      const [s, z] = box(j)
      // Item start, centre or end at the viewport start, centre or end.
      return scrollTo(s + m.o + (z - viewport) * ALIGN[m.a])
    }
    if (!n) return
    // First surviving point: the key, then the fallbacks, then the item now at the anchor index.
    let p: Point = m
    let j = keys.indexOf(m.k)
    for (const q of m.f) if (j < 0) j = keys.indexOf((p = q).k)
    if (j < 0) {
      j = clamp(m.i, 0, n - 1)
      p = m
    }
    const d = p.d
    if (opts.getKey(j) !== m.k) mode = { t: 1, k: opts.getKey(j), d, i: j, f: [] }
    scrollTo(edgeOf(j) - d)
  }

  // ------------------------------------------------------------------- cycle

  const measureRows = (): void =>
    rows.forEach((el, key) => {
      const i = keys.indexOf(key)
      if (i < 0) return
      const s = sc!.measure(el).size
      if (s !== idx.size(i)) {
        idx.setSize(i, s)
        resized = needBackground = true
      }
      cache.set(key, s)
    })

  /** Edge trigger: fires when `near` and `more`, once per edge item; re-arms when no longer near. */
  const reach = (near: boolean, more: unknown, key: Key, latch: Key | undefined, cb?: () => void): Key | undefined => {
    if (!near) return undefined
    if (more && latch !== key) cb?.()
    return more ? key : latch
  }

  const notify = (): void => {
    const o = opts
    const v = eff() - listStart
    const n = idx.count
    const { start: s, end: e } = range(-EPSILON)
    const sk = n ? o.getKey(s) : null
    const ek = n ? o.getKey(e) : null
    let changed = s !== visible.startIndex || e !== visible.endIndex || sk !== visible.startKey || ek !== visible.endKey
    if (changed) o.onRangeChange?.((visible = { startIndex: s, endIndex: e, startKey: sk, endKey: ek }))
    const at = api.isAtEdge()
    if (at !== atEdgeState) {
      changed = true
      o.onAtEdgeChange?.((atEdgeState = at))
    }
    if (n && !sc!.overscrolled()) {
      startLatch = reach(v < (o.startThreshold ?? 300), o.hasMoreStart, o.getKey(0), startLatch, o.onStartReached)
      endLatch = reach(idx.total() - v - viewport < (o.endThreshold ?? 300), o.hasMoreEnd, o.getKey(n - 1), endLatch, o.onEndReached)
    }
    if (changed) listeners.forEach((l) => l())
  }

  /**
   * The reconcile loop: measure, write spacers, restore the anchor, then check
   * the range. When the range changes a re-render is requested and the next
   * commit continues, before paint. Never runs from an animation frame.
   */
  const cycle = (sync: boolean): void => {
    if (!sc) return
    measureRows()
    const { start, end } = committed
    const total = idx.total()
    if (end < start || end >= idx.count) sc.setSpacers(total, 0)
    else sc.setSpacers(idx.offsetOf(start), total - idx.offsetOf(end) - idx.size(end))
    listStart = sc.listStart() + eff()
    restore()
    lastSize = sc.scrollSize()
    const r = rangeNow()
    if ((r.start !== start || r.end !== end) && passes++ < MAX_PASSES) return host.render(sync)
    passes = 0
    const m = mode
    // Settle: re-anchor on the measured layout (so fallback deltas never go
    // stale), and turn an edge mode that is not a pin into an anchor. The same
    // anchor keeps its intended delta when it is off by a skipped correction
    // (at most EPSILON), so those cannot add up. A larger difference means the
    // position was unreachable (clamped): adopt it, so a later change that
    // makes room does not catch up with a visible jump.
    const c = (m.t ? m.t < 2 : m !== EDGE || opts[more]) && capture()
    if (c) {
      if (m.t === 1 && c.k === m.k && Math.abs(m.d - c.d) <= EPSILON) shift(c, m.d - c.d)
      mode = c
    }
    lastEff = eff()
    notify()
    if (needBackground) background()
  }

  // ------------------------------------------------------------- key changes

  /** Follow decision for items added at the pinned edge: true, false, or undefined (no decision). */
  const follows = (d: KeyDiff, o: VirtualizerOptions): boolean | undefined => {
    const added = d.rebuild ? 0 : atEnd ? d.append : d.prepend
    if (!added || !keys.count) return undefined
    const f = o.follow
    const at = mode === EDGE
    return (typeof f === 'function' ? f({ atEdge: at, added, count: o.count }) : (f ?? at)) && !o[more]
  }

  const rebuild = (o: VirtualizerOptions): void => {
    keys.apply(REBUILD, o.count, o.getKey, o.getKey, (k) => cache.delete(k))
    idx.reset(o.count, (i) => sizeFor(o, i))
  }

  const applyDiff = (d: KeyDiff, o: VirtualizerOptions): void => {
    if (d === NO_CHANGE) return
    const f = follows(d, o)
    if (f) mode = EDGE
    else if (f === false && mode === EDGE) recapture()
    if (d.rebuild) return rebuild(o)
    keys.apply(d, o.count, o.getKey, opts.getKey, (k) => cache.delete(k))
    const est = (i: number): number => sizeFor(o, i)
    idx.trimStart(d.trimStart)
    idx.trimEnd(d.trimEnd)
    idx.prepend(d.prepend, est)
    idx.append(d.append, est)
    if (mode.t === 1) mode.i += d.prepend - d.trimStart
  }

  /**
   * Range predicted for `o` before its diff is applied: the committed range
   * shifted by the edge change, so every mounted row stays mounted, and moved
   * to the pinned edge when pinned. Read-only; the commit loop adds rows that
   * became reachable before paint.
   */
  const project = (d: KeyDiff, o: VirtualizerOptions): Range => {
    const last = o.count - 1
    const f = follows(d, o)
    const span = Math.max(0, committed.end - committed.start)
    let start = committed.start + (d.rebuild ? 0 : d.prepend - d.trimStart)
    if (f ?? mode === EDGE) start = atEnd ? last - span : 0
    start = clamp(start, 0, last)
    return { start, end: clamp(start + span, start, last) }
  }

  // ------------------------------------------------------------------ events

  /** Target lock: release after TARGET_FRAMES frames without a resize, or after TARGET_MAX_MS. */
  const lock = (): void =>
    later(2, () => {
      const m = mode
      if (m.t !== 2) return
      m.q = resized ? 0 : m.q + 1
      resized = false
      if (m.q >= TARGET_FRAMES || sc!.now() - m.s >= TARGET_MAX_MS) recapture()
      else lock()
    })

  /** Idle work: full key validation (rebuild on mismatch) and estimate refresh when the average drifts > 10%. */
  const background = (): void =>
    later(
      1,
      () => {
        needBackground = false
        const o = opts
        let dirty = !keys.validate(0, keys.count - 1, o.getKey)
        if (dirty) rebuild(o)
        const avg = cache.average()
        if (!o.estimateSize && avg && Math.abs(avg - estimate) > estimate / 10) {
          estimate = avg
          for (let i = 0; i < idx.count; i++) if (cache.get(opts.getKey(i)) === undefined) idx.setSize(i, avg)
          dirty = true
        }
        if (dirty) cycle(false)
      },
      BACKGROUND_MS,
    )

  const onEvent = (type: ScrollerEvent): void => {
    const s = sc
    if (!s) return
    const scroll = type === 'scroll'
    if (scroll || type === 'resize') {
      // Browsers clamp the offset during layout and fire `scroll` before the
      // resize callback, so both events first apply a size change. An offset
      // change that comes with a viewport change, or that lands on the end of
      // content that shrank, is such a clamp, not the user.
      const vp = s.viewport()
      const cr = s.crossSize()
      const size = s.scrollSize()
      const same = vp === viewport && !(size < lastSize && s.offset() >= size - vp - 1)
      if (cr !== cross) cache.markStale()
      // Keep the pinned edge fixed: for `end`, content moves with the viewport end.
      if (atEnd) shift(mode, vp - viewport)
      resized ||= !scroll || !same
      cross = cr
      viewport = vp
      if (scroll) {
        // Detect user movement before a deferred correction is committed.
        const moved = same && Math.abs(eff() - lastEff) > EPSILON
        lastScrollAt = s.now()
        commitPending(false)
        if (moved) {
          if (api.isAtEdge() && !opts[more]) mode = EDGE
          else recapture()
        }
      }
      return cycle(scroll)
    }
    if (type === 'scrollend') return commitPending(true)
    if (type.startsWith('touch')) {
      // touchstart, touchend or touchcancel. Momentum may follow a touch end.
      lastScrollAt = s.now()
      if (!(touching = type === 'touchstart')) return scheduleIdle()
    }
    // Any other event is direct input: it cancels a scrollToKey lock.
    if (mode.t === 2) recapture()
  }


  /** Imperative scroll: position now, then run the loop in a microtask (safe inside a host render or effect). */
  const kick = (): void => {
    if (!sc) return
    restore()
    lock()
    queueMicrotask(() => cycle(true))
  }

  // --------------------------------------------------------------------- api

  const api: Virtualizer = {
    plan(o = opts) {
      let r = EMPTY
      if (sc && o.count) {
        const d = keys.diff(o.count, o.getKey)
        r = d === NO_CHANGE ? rangeNow() : project(d, o)
      }
      return { ...r, options: o }
    },

    commit(range) {
      const o = range.options
      idx.setLayout(o.gap, o.paddingStart, o.paddingEnd)
      const d = keys.diff(o.count, o.getKey)
      // Old state is still current here, so captures and trims see the old keys.
      applyDiff(d, o)
      opts = o
      committed = range
      // Lazy validation: rendered keys must match, otherwise rebuild.
      if (!keys.validate(committed.start, committed.end, o.getKey)) rebuild(o)
      needBackground = true
        const total = o.hasMoreStart || o.hasMoreEnd ? -1 : o.count
      rows.forEach((el, key) => keys.indexOf(key) < 0 || sc?.setIndex(el, keys.indexOf(key), total))
      cycle(false)
    },

    attach(scroller) {
      api.destroy()
      sc = scroller as Scroller
      viewport = sc.viewport()
      cross = sc.crossSize()
      timers[3] = sc.listen(onEvent)
      rows.forEach((el) => sc!.observe(el))
      lastEff = eff()
        if (mode.t === 2) {
        mode.s = sc.now()
        lock()
      }
      cycle(false)
    },

    measureElement(el, key) {
      const prev = rows.get(key)
      if (prev === el) return
      if (prev) sc?.unobserve(prev)
      rows.delete(key)
      if (el) {
        rows.set(key, el)
        sc?.observe(el)
      }
    },

    destroy() {
      timers.splice(0).forEach((t) => t?.())
      sc?.translate((pending = 0))
      sc = null
    },

    scrollToKey(key, o = {}) {
      if (keys.indexOf(key) < 0) return false
      mode = { t: 2, k: key, a: o.align ?? 'start', o: o.offset ?? 0, s: sc ? sc.now() : 0, q: 0 }
      // Jump to the estimate now so a blank frame never paints; commits refine it.
      kick()
      return true
    },

    scrollToIndex(index, o) {
      return index >= 0 && index < keys.count && api.scrollToKey(opts.getKey(index), o)
    },

    scrollToEdge(edge = align) {
      mode = edge === align ? EDGE : { t: 0, e: edge }
      kick()
    },

    isAtEdge(edge = align) {
      return (edge === 'start' ? eff() : maxScroll() - eff()) <= (opts.atEdgeThreshold ?? 2)
    },

    getVisibleRange: () => visible,

    getItemRect(key) {
      const i = keys.indexOf(key)
      return i < 0 ? null : { start: listStart + idx.offsetOf(i), size: idx.size(i), measured: cache.isFresh(key) }
    },

    // Both are closures that do not use `this`.
    getTotalSize: idx.total,
    indexOf: keys.indexOf,

    getSnapshot() {
      const m = mode.t === 1 ? mode : capture()
      return { key: m ? m.k : null, index: m ? m.i : 0, delta: m ? m.d : 0, pinned: mode === EDGE }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return api
}
