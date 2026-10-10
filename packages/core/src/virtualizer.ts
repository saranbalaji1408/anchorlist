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
  /** Anchor item index at the time (informational; -1 for an empty list). */
  readonly index: number
  /** Intended position of the anchor's `align` edge relative to the viewport start, in px. */
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
  /**
   * Scrolls to an edge (default: `align`). At the `align` edge with no `hasMore`
   * there, the list becomes pinned; any other edge becomes an item anchor once
   * the frame settles.
   */
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
  /** Fallbacks, set only by a change that may remove the anchor: later rows first. */
  f: Point[]
}
/** Scrolling to an item; locked until sizes settle. */
interface TargetMode {
  t: 2
  k: Key
  a: ItemAlign
  o: number
  /** Start time, set by the first lock frame. */
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
  let mode: Mode = snap && snap.key !== null && !snap.pinned ? { t: 1, k: snap.key, d: snap.delta, f: [] } : EDGE

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
  /**
   * Actual minus intended effective offset after the last restore: the
   * whole-pixel rounding remainder (or a skipped correction). Captures use the
   * intended offset, so the remainder never builds up across anchors.
   */
  let err = 0
  /** err at the last settled (painted) frame, carried by item-anchor writes. */
  let carry = 0
  /** Keys are duplicated: lazy validation is off until the list changes. */
  let dup = false
  let passes = 0
  let resized = false
  /** Key of the edge item when `onStartReached` / `onEndReached` last fired, while inside the zone. */
  let startLatch: Key | undefined
  let endLatch: Key | undefined
  let atEdgeState: boolean | undefined
  let visible = NO_VISIBLE
  let estimate = 48
  let needBackground = false

  /** Only called with a scroller attached. */
  const later = (slot: number, fn: () => void, ms?: number): void => {
    timers[slot]?.()
    timers[slot] = ms ? sc!.timeout(fn, ms) : sc!.frame(fn)
  }
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)
  /** The `hasMore` option of the pinned edge. */
  const more = atEnd ? 'hasMoreEnd' : 'hasMoreStart'
  const eff = (): number => (sc ? sc.offset() + pending : 0)
  // Negative when the content is shorter than the viewport (writes then clamp to 0).
  const maxScroll = (): number => (sc ? sc.scrollSize() - viewport : 0)
  /** Size of item `i` for `o`: cached, else estimated. */
  const sizeFor =
    (o: VirtualizerOptions) =>
    (i: number): number =>
      cache.get(o.getKey(i)) ?? o.estimateSize?.(i) ?? estimate

  /** Items intersecting the viewport grown by `over` px on each side, at the current offset. */
  const range = (over: number): Range => {
    const v = eff() - listStart
    const start = idx.findIndexAtOffset(v - over)
    return idx.count ? { start, end: idx.findIndexAtOffset(v + viewport + over) } : EMPTY
  }
  const rangeNow = (): Range => range(opts.overscan ?? 400)

  /** Content-space start and size of item `i`: from the DOM when mounted, else from the index. */
  const box = (i: number, model?: 1): [number, number] => {
    const row = sc && !model && rows.get(opts.getKey(i))
    if (!row) return [listStart + idx.offsetOf(i), idx.size(i)]
    const b = sc!.measure(row)
    return [b.start + eff(), b.size]
  }
  const edgeOf = (i: number, model?: 1): number => {
    const [s, z] = box(i, model)
    return atEnd ? s + z : s
  }

  // ------------------------------------------------------------------ anchor

  /**
   * Anchors the first item reaching into the viewport, relative to the
   * intended offset. With `model`, from model positions only (the DOM may
   * already show uncommitted changes).
   */
  const capture = (model?: 1): ItemMode | null => {
    const n = idx.count
    const e = eff() - err
    // Without a scroller nothing is mounted, so this uses model positions.
    if (!n) return null
    let i = idx.findIndexAtOffset(e - listStart)
    while (i < n - 1 && listStart + idx.offsetOf(i) + idx.size(i) <= e) i++
    return { t: 1, k: opts.getKey(i), d: edgeOf(i, model) - e, f: [] }
  }

  /**
   * Before a change that may remove the anchor: fallback points at distances
   * 1, 2, 4, ... up to the list edge, after the anchor first, then before it,
   * from the model layout before the change. Rows on one side of a removed run
   * move together, so holding any surviving later point keeps every row after
   * the gap still (for both aligns). `key` returns keys in the index's current order.
   */
  const fallbacks = (key: (i: number) => Key): void => {
    const m = mode
    const n = idx.count
    const e = eff() - err
    if (m.t === 1 && keys.indexOf(m.k) >= 0)
      for (const dir of [1, -1])
        for (let s = 1, j; s < 2 * n; s *= 2)
          m.f.push({ k: key((j = clamp(keys.indexOf(m.k) + dir * s, 0, n - 1))), d: listStart + idx.offsetOf(j) + (atEnd ? idx.size(j) : 0) - e })
  }
  const recapture = (): void => {
    mode = capture() ?? mode
  }
  /** Moves an item anchor by `by` px (fallbacks only exist between a removal and its restore). */
  const shift = (m: Mode, by: number): void => {
    if (m.t === 1) m.d += by
  }

  // ------------------------------------------------------------- scrolling

  /** Touch WebKit during touch or momentum, and any rubber-band overscroll. */
  const defer = (): boolean =>
    sc!.overscrolled() !== 0 || (sc!.touchWebKit && (touching || sc!.now() - lastScrollAt < IDLE_MS))

  /**
   * Writes a whole-pixel offset and clears any pending transform. Engines
   * store whole pixels at DPR 1 and some truncate, so rounding first makes
   * every engine land within 0.5 px. The read-back remainder goes into err.
   */
  const write = (v: number): void => {
    if (pending) sc!.translate((pending = 0))
    sc!.setOffset(Math.round(v))
  }
  const commitPending = (force: boolean): void => {
    // Only reachable with a scroller (events and timers stop on destroy).
    if (pending && !touching) {
      if (force || !defer()) {
        // Our own write: it only changes the effective offset by rounding, which
        // goes into lastEff (user movement stays visible) and err.
        let e = eff()
        write(sc!.offset() + pending)
        lastEff += e = eff() - e
        carry = clamp((err += e), -0.5, 0.5)
      } else scheduleIdle()
    }
  }
  const scheduleIdle = (): void => later(0, () => commitPending(false), IDLE_MS)

  /** Moves the effective offset, deferring into a transform when a write would interrupt the user. */
  const scrollTo = (desired: number): void => {
    const target = clamp(desired, 0, maxScroll())
    // An item anchor carries the remainder of the last painted frame (up to half
    // a pixel), so a change moves content by at most 0.5 px from where it is
    // (more only to keep the error within 1 px). Targets and edges are exact,
    // and so is a clamped position.
    const t = clamp(desired + carry, 0, maxScroll())
    // A whole-pixel write of the same value is a no-op; a transform is only
    // written for a correction above EPSILON.
    if (!defer()) write(t)
    else if (Math.abs(t - eff()) > EPSILON) {
      pending = t - sc!.offset()
      sc!.translate(-pending)
      scheduleIdle()
    }
    lastEff = eff()
    // A clamped target becomes the intended position, so it is adopted.
    err = lastEff - target
  }


  /**
   * Adopts user movement: the offset changed since our last write or
   * observation. Runs at the start of every commit and pass, not only on
   * `scroll`, because a re-render can commit before the scroll event arrives.
   * Content that shrank under our offset is the browser's clamp, not the
   * user. An item anchor moves with the user, so a change committed
   * at the same time (a prepend) is still compensated; it is re-captured after
   * the next restore. Other modes re-anchor from the model, because the DOM
   * may already show the new rows.
   */
  const adopt = (): boolean => {
    const max = maxScroll()
    const d = eff() - lastEff
    // A clamp (our last offset is past the new end and the offset sits on it)
    // moves the actual offset but not the intended one: it goes into err.
    const user = Math.abs(d) > EPSILON && !(sc!.offset() >= max - 1 && lastEff - pending > max)
    lastEff = eff()
    if (!user) err += d
    else {
      // The actual position is the user's: the remainder is dropped.
      const e = err
      err = carry = 0
      // At the align edge: pin (settle turns it back into an anchor when hasMore is set there).
      if (api.isAtEdge()) mode = EDGE
      else if (mode.t === 1) shift(mode, -e - d)
      else mode = capture(1) ?? mode
    }
    return user
  }



  const restore = (): void => {
    const m = mode
    if (!m.t) return scrollTo(m.e === 'end' ? Infinity : 0)
    if (m.t === 2) {
      const j = keys.indexOf(m.k)
      if (j < 0) return recapture()
      const [s, z] = box(j)
      // Item start, centre or end at the viewport start, centre or end.
      return scrollTo(s + m.o + (z - viewport) * ALIGN[m.a])
    }
    // Nothing to anchor to while empty (a clear, or attach before the first commit).
    if (!idx.count) return
    // First surviving point: the anchor, then its fallbacks. None: the list was
    // cleared or replaced, so start over at the `align` edge like a fresh mount.
    let p: Point = m
    let j = keys.indexOf(m.k)
    for (const q of m.f) if (j < 0) j = keys.indexOf((p = q).k)
    if (j < 0) {
      mode = EDGE
      return restore()
    }
    if (p !== m) mode = { t: 1, k: p.k, d: p.d, f: [] }
    scrollTo(edgeOf(j) - p.d)
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
      // Mounted rows are never evicted, whatever maxCachedSizes says.
      cache.set(key, s, rows.size)
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
    if (changed) {
      visible = { startIndex: s, endIndex: e, startKey: sk, endKey: ek }
      o.onRangeChange?.(visible)
    }
    const at = api.isAtEdge()
    if (at !== atEdgeState) {
      changed = true
      atEdgeState = at
      o.onAtEdgeChange?.(at)
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
    adopt()
    measureRows()
    const { start, end } = committed
    const total = idx.total()
    if (end < start || end >= idx.count) sc.setSpacers(total, 0)
    else sc.setSpacers(idx.offsetOf(start), total - idx.offsetOf(end) - idx.size(end))
    listStart = sc.listStart() + eff()
    restore()
    const r = rangeNow()
    if ((r.start !== start || r.end !== end) && passes++ < MAX_PASSES) return host.render(sync)
    passes = 0
    const m = mode
    // Settle: re-anchor on the measured layout (so fallback deltas never go
    // stale), and turn an edge mode that is not a pin into an anchor. Captures
    // are relative to the intended offset, so a whole-pixel remainder or a
    // skipped correction (each at most 0.5 px) never builds up, and a clamped
    // (unreachable) position is adopted, so a later change that makes room
    // does not catch up with a visible jump.
    if (m.t ? m.t < 2 : m !== EDGE || opts[more]) recapture()
    carry = clamp(err, -0.5, 0.5)
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

  /** Rebuilds keys and sizes for `o`; with `fb`, first takes fallbacks in the current order. */
  const rebuild = (o: VirtualizerOptions, fb = 1): void => {
    if (fb) fallbacks(o.getKey)
    keys.apply(REBUILD, o.count, o.getKey, o.getKey, cache.delete)
    idx.reset(o.count, sizeFor(o))
    // Still invalid after a rebuild: duplicated keys.
    dup = !keys.validate(0, o.count - 1, o.getKey)
  }

  const applyDiff = (d: KeyDiff, o: VirtualizerOptions): void => {
    if (d === NO_CHANGE) return
    dup = false
    const f = follows(d, o)
    if (f) mode = EDGE
    else if (f === false && mode === EDGE) recapture()
    fallbacks(opts.getKey)
    if (d.rebuild) return rebuild(o, 0)
    keys.apply(d, o.count, o.getKey, opts.getKey, cache.delete)
    const est = sizeFor(o)
    idx.trimStart(d.trimStart)
    idx.trimEnd(d.trimEnd)
    idx.prepend(d.prepend, est)
    idx.append(d.append, est)
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
    // A rebuild has prepend = trimStart = 0.
    let start = committed.start + d.prepend - d.trimStart
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
      if (m.q >= TARGET_FRAMES || sc!.now() - (m.s ||= sc!.now()) >= TARGET_MAX_MS) recapture()
      else lock()
    })

  /** Idle work: full key validation (rebuild on mismatch) and estimate refresh when the average drifts > 10%. */
  const background = (): void =>
    later(
      1,
      () => {
        needBackground = false
        const o = opts
        let dirty = !dup && !keys.validate(0, keys.count - 1, o.getKey)
        if (dirty) rebuild(o)
        const avg = cache.average()
        if (!o.estimateSize && avg && Math.abs(avg - estimate) > estimate / 10) {
          estimate = avg
          // Unmeasured items take the new estimate (O(n)).
          idx.reset(idx.count, sizeFor(o))
          dirty = true
        }
        if (dirty) cycle(false)
      },
      BACKGROUND_MS,
    )

  const onEvent = (type: ScrollerEvent): void => {
    const s = sc
    if (!s) return
    // Any event counts as activity for touch WebKit deferral (momentum may follow).
    lastScrollAt = s.now()
    const scroll = type === 'scroll'
    if (scroll || type === 'resize') {
      // Browsers clamp the offset during layout and fire `scroll` before the
      // resize callback, so both events first apply a size change. An offset
      // change that comes with a viewport change, or that lands on the end of
      // content that shrank, is such a clamp, not the user.
      const vp = s.viewport()
      const cr = s.crossSize()
      if (cr !== cross) cache.markStale()
      // Keep the pinned edge fixed: for `end`, content moves with the viewport end.
      if (atEnd) shift(mode, vp - viewport)
      // The offset change that comes with a viewport change is the browser's clamp.
      if (vp !== viewport) lastEff = eff()
      resized ||= !scroll || vp !== viewport
      cross = cr
      viewport = vp
      if (scroll) {
        // The DOM is still the committed one: re-anchor where the user is now.
        if (adopt() && mode.t === 1) recapture()
        commitPending(false)
      }
      return cycle(scroll)
    }
    // touchstart, touchend or touchcancel.
    if (type.startsWith('touch') && !(touching = type === 'touchstart')) return scheduleIdle()
    // Any other event is direct input: it cancels a scrollToKey lock.
    if (mode.t === 2) recapture()
  }

  /** Imperative scroll: position now, then run the loop in a microtask (safe inside a host render or effect). */
  const kick = (m: Mode): true => {
    mode = m
    if (sc) {
      restore()
      lock()
      queueMicrotask(() => cycle(true))
    }
    return true
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
      // Old state is still current here, so captures and trims see the old keys,
      // and user movement is adopted before the follow decision.
      if (sc) adopt()
      const d = keys.diff(o.count, o.getKey)
      applyDiff(d, o)
      opts = o
      committed = range
      // Lazy validation: rendered keys must match, otherwise rebuild. If they
      // still do not match, keys are duplicated: stop rebuilding on every commit
      // until the list changes again.
      if (!dup && !keys.validate(range.start, range.end, o.getKey)) rebuild(o)
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
        lock()
      cycle(false)
    },

    measureElement(el, key) {
      const prev = rows.get(key)
      // Registering the same element again just re-observes it.
      if (prev) sc?.unobserve(prev)
      rows.delete(key)
      if (el) {
        rows.set(key, el)
        sc?.observe(el)
      }
    },

    destroy() {
      timers.splice(0).forEach((t) => t!())
      sc?.translate((pending = 0))
      sc = null
    },

    scrollToKey(key, o = {}) {
      // Jump to the estimate now so a blank frame never paints; commits refine it.
      return keys.indexOf(key) >= 0 && kick({ t: 2, k: key, a: o.align ?? 'start', o: o.offset ?? 0, s: 0, q: 0 })
    },

    scrollToIndex(index, o) {
      return index >= 0 && index < keys.count && api.scrollToKey(opts.getKey(index), o)
    },

    scrollToEdge(edge = align) {
      kick(edge === align ? EDGE : { t: 0, e: edge })
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
      return { key: m?.k ?? null, index: keys.indexOf(m?.k as Key), delta: m?.d ?? 0, pinned: mode === EDGE }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return api
}
