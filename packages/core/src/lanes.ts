import type { Scroller } from './scroller'
import type { Key, Range } from './types'
import type { VirtualizerOptions } from './virtualizer'

/** Options of {@link grid} and {@link masonry}. */
export interface LanesOptions {
  /** Number of lanes: columns for a vertical list, rows for a horizontal one. At least 1. */
  lanes: number
  /** Gap between lanes and between items in a lane, in px. Default 0. */
  gap?: number
  /** Lanes are rows and items run horizontally. Default false. */
  horizontal?: boolean
}

/** Position of an item in a lane layout. */
export interface LanePosition {
  /** Main-axis start in list space (from the list element's start), in px. */
  readonly start: number
  /** Lane index, from the cross-axis start. */
  readonly lane: number
}

/**
 * A lane layout (grid or masonry) for a virtualizer. Items are positioned
 * absolutely inside the list; the 1-D engine sees each item's share of the
 * main axis, so anchoring, edges and scrolling work unchanged.
 *
 * Host contract, in addition to the plain list contract:
 * - pass `lanes.options(options)` to `plan()` (it converts estimates, and
 *   clears `gap`, `paddingStart` and `paddingEnd`, which lanes do not use);
 * - render items `lanes.range(plan, count)` instead of the plan;
 * - in the commit phase, call `lanes.sync(options)` with the original options
 *   before `commit(plan)`;
 * - attach `lanes.scroller(scroller)`: it writes each item's `position`,
 *   main-axis start, cross-axis offset and cross size, and sizes the list;
 * - give the list `position: relative`. Overscan should be at least the
 *   largest item size (masonry items start up to one item above or below
 *   their share of the main axis).
 */
export interface Lanes {
  /** Number of lanes. */
  readonly lanes: number
  /** Options for the engine: per-item main-axis shares as estimates; no gap or padding. Pure. */
  options(options: VirtualizerOptions): VirtualizerOptions
  /** The items to render for `range`: whole rows for a grid, `range` itself for masonry. Pure. */
  range(range: Range, count: number): Range
  /** Records the committed items. Call in the commit phase, before `commit(plan)`. */
  sync(options: VirtualizerOptions): void
  /** Position of item `index` (lays out lazily up to it). */
  position(index: number): LanePosition
  /** Wraps a scroller so that the engine measures shares and the layout positions the items. */
  scroller<E>(scroller: Scroller<E>): Scroller<E>
}

/** Layout strategy: everything that differs between grid and masonry. */
interface Strategy {
  /** Items changed from index `from` on; -1 when the items changed structurally. */
  invalidate(from: number): void
  /** Lays out items up to `to` and returns its position. */
  place(i: number): LanePosition
  /** Main-axis end of the layout through item `to` (gaps excluded), in px. */
  extent(to: number): number
  /** The engine's main-axis share of item `i` of `count`; `live(j)` is the current size of item `j`. */
  share(i: number, live: (j: number) => number, count: number): number
  /** First and last index to render for an engine range. */
  range(r: Range, count: number): Range
}

const DEFAULT_SIZE = 48

/** A copy of `a` with room for index `need` (doubling). */
const grow = <T extends Float64Array | Int32Array>(a: T, need: number): T => {
  const b = new (a.constructor as new (n: number) => T)(Math.max(16, need * 2 + 2))
  b.set(a)
  return b
}

/**
 * Shared machinery: item sizes by key, the commit-phase sync and the scroller
 * wrapper. `make` builds the layout strategy on top of `size(i)` (measured,
 * else estimated) and the current item count.
 */
function lanes(
  { lanes: n, gap: g = 0, horizontal }: LanesOptions,
  make: (size: (i: number) => number, count: () => number, n: number, g: number) => Strategy,
): Lanes {
  const measured = new Map<Key, number>()
  let count = 0
  let getKey: (i: number) => Key = (i) => i
  let estimate: (i: number) => number = () => DEFAULT_SIZE
  let first: Key | undefined
  let last: Key | undefined
  const size = (i: number): number => measured.get(getKey(i)) ?? estimate(i)
  const layout = make(size, () => count, n, g)
  const [main, cross, crossSize] = horizontal
    ? (['insetInlineStart', 'top', 'height'] as const)
    : (['top', 'insetInlineStart', 'width'] as const)
  // Each lane is an equal share of the list's cross size, minus the gaps between lanes.
  const laneSize = `(100% - ${(n - 1) * g}px) / ${n}`

  const api: Lanes = {
    lanes: n,
    options: (o) => ({
      ...o,
      gap: 0,
      paddingStart: 0,
      paddingEnd: 0,
      estimateSize: (i) => layout.share(i, (j) => o.estimateSize?.(j) ?? DEFAULT_SIZE, o.count),
    }),
    range: layout.range,
    sync(o) {
      const was = count
      const k = (i: number): Key | undefined => (i >= 0 && i < o.count ? o.getKey(i) : undefined)
      const sameStart = k(0) === first
      getKey = o.getKey
      estimate = o.estimateSize ?? (() => DEFAULT_SIZE)
      count = o.count
      if (!sameStart || k(was - 1) !== last) {
        layout.invalidate(-1)
        // Forget sizes of removed items once they outnumber the live ones.
        if (measured.size > 2 * count + 64) {
          const live = new Map<Key, number>()
          for (let i = 0; i < count; i++) {
            const v = measured.get(getKey(i))
            if (v !== undefined) live.set(getKey(i), v)
          }
          measured.clear()
          live.forEach((v, key) => measured.set(key, v))
        }
      } else if (count !== was) layout.invalidate(was - 1)
      first = k(0)
      last = k(count - 1)
    },
    position: (i) => layout.place(i),
    scroller<E>(base: Scroller<E>): Scroller<E> {
      /** Mounted items and their index (from the engine's setIndex). */
      const items = new Map<E, number>()
      const byIndex = new Map<number, E>()
      const index = (e: E): number => {
        const i = items.get(e)
        return i !== undefined && i < count ? i : -1
      }
      const live = (j: number): number => {
        const e = byIndex.get(j)
        return e !== undefined && items.get(e) === j ? base.measure(e).size : size(j)
      }
      /** Writes the item's position and cross size. */
      const put = (e: E, i: number): void => {
        const p = layout.place(i)
        const s = (e as { style: Record<string, string> }).style
        s.position = 'absolute'
        s[main] = p.start + 'px'
        s[cross] = `calc(${laneSize} * ${p.lane} + ${p.lane * g}px)`
        s[crossSize] = `calc(${laneSize})`
      }
      const record = (i: number, s: number): void => {
        const key = getKey(i)
        if (measured.get(key) !== s) {
          measured.set(key, s)
          layout.invalidate(i)
        }
      }
      return {
        ...base,
        setIndex(e, i, total) {
          items.set(e, i)
          byIndex.set(i, e)
          base.setIndex(e, i, total)
          // Out of flow at the lane's size before the first measurement.
          if (i < count) put(e, i)
        },
        unobserve(e) {
          const i = items.get(e)
          if (i !== undefined && byIndex.get(i) === e) byIndex.delete(i)
          items.delete(e)
          base.unobserve(e)
        },
        measure(e) {
          const box = base.measure(e)
          const i = index(e)
          if (i < 0) return box
          record(i, box.size)
          return { start: box.start, size: layout.share(i, live, count) }
        },
        setSpacers(before, after) {
          const mounted: number[] = []
          items.forEach((_, e) => {
            const i = index(e)
            if (i < 0) return
            mounted.push(i)
            put(e, i)
          })
          // Items are out of flow: the list's size is the layout through the
          // last rendered item, plus the engine's size of everything after it.
          // That is the end of the longest run of consecutive indices: an item
          // kept mounted outside the range (focus) is a single index apart, and
          // the engine's `after` already counts it.
          mounted.sort((a, b) => a - b)
          let hi = -1
          for (let k = 0, run = 0, best = 0; k < mounted.length; k++) {
            run = k && mounted[k]! - mounted[k - 1]! < 2 ? run + 1 : 1
            if (run > best) [best, hi] = [run, mounted[k]!]
          }
          if (hi < 0) base.setSpacers(before, after)
          else base.setSpacers(0, layout.extent(hi) + after)
        },
      }
    },
  }
  return api
}

/**
 * A grid of `lanes` columns (rows when horizontal). Items fill rows in index
 * order; a row is as tall as its tallest item. The engine sees each row's
 * size (plus the gap) on the row's first item and 0 on the others, so its
 * `SizeIndex` holds exactly the row sizes and its offsets are the rows'
 * offsets. Row offsets are laid out lazily, up to the last row needed.
 *
 * Inserting or removing a number of items that is not a multiple of `lanes`
 * before the viewport reflows the rows after it; the anchor item keeps its
 * main-axis position.
 */
export function grid(options: LanesOptions): Lanes {
  return lanes(options, (size, count, n, g) => {
    let top = new Float64Array(0)
    let rowSizes = new Float64Array(0)
    /** Rows `[0, done)` are laid out. */
    let done = 0
    /** Size of row `r` of `c` items: its tallest item, using `of(j)` for item sizes. */
    const rowSize = (r: number, of: (j: number) => number, c = count()): number => {
      let s = 0
      for (let j = r * n; j < Math.min(r * n + n, c); j++) s = Math.max(s, of(j))
      return s
    }
    const layOut = (i: number): number => {
      const row = Math.floor(i / n)
      if (row >= top.length) {
        top = grow(top, row)
        rowSizes = grow(rowSizes, row)
      }
      for (; done <= row; done++) {
        top[done] = done ? top[done - 1]! + rowSizes[done - 1]! + g : 0
        rowSizes[done] = rowSize(done, size)
      }
      return row
    }
    return {
      invalidate(from) {
        done = Math.max(0, Math.min(done, Math.floor(from / n)))
      },
      place(i) {
        // Lay out first: it may replace `top`.
        const row = layOut(i)
        return { start: top[row]!, lane: i % n }
      },
      extent(to) {
        const row = layOut(to)
        return top[row]! + rowSizes[row]!
      },
      share: (i, live, c) => (i % n ? 0 : rowSize(i / n, live, c) + g),
      range: (r, c) => (r.end < r.start ? r : { start: r.start - (r.start % n), end: Math.min(c - 1, r.end - (r.end % n) + n - 1) }),
    }
  })
}

/**
 * A masonry layout of `lanes` columns (rows when horizontal): each item goes
 * into the lane that ends first (the lowest-numbered one on a tie). The layout
 * is computed lazily, only up to the last item that is needed, in typed
 * arrays, with a running maximum of lane ends for the list size. The engine
 * sees each item's share of the main axis, `(size + gap) / lanes`; an item
 * starts at most one item size before or after that share's position.
 *
 * A size change re-lays out the items after it, so they may change lanes;
 * the anchor item keeps its main-axis position.
 */
export function masonry(options: LanesOptions): Lanes {
  return lanes(options, (size, count, n, g) => {
    let start = new Float64Array(0)
    let end = new Float64Array(0)
    let max = new Float64Array(0)
    let lane = new Int32Array(0)
    /** Items `[0, done)` are laid out. */
    let done = 0
    const ends = new Float64Array(n)
    const place = (to: number): void => {
      if (to < done) return
      if (to >= start.length) {
        start = grow(start, to)
        end = grow(end, to)
        max = grow(max, to)
        lane = grow(lane, to)
      }
      // Lane ends before `done`: the last item of each lane, scanning back.
      ends.fill(-1)
      for (let j = done - 1, left = n; j >= 0 && left; j--) {
        if (ends[lane[j]!]! < 0) {
          ends[lane[j]!] = end[j]!
          left--
        }
      }
      for (let l = 0; l < n; l++) if (ends[l]! < 0) ends[l] = 0
      for (let i = done; i <= to; i++) {
        let l = 0
        for (let k = 1; k < n; k++) if (ends[k]! < ends[l]!) l = k
        start[i] = ends[l]!
        ends[l] = end[i] = start[i]! + size(i) + g
        lane[i] = l
        max[i] = Math.max(i ? max[i - 1]! : 0, end[i]!)
      }
      done = to + 1
    }
    return {
      invalidate(from) {
        done = Math.max(0, Math.min(done, from))
      },
      place(i) {
        place(i)
        return { start: start[i]!, lane: lane[i]! }
      },
      extent(to) {
        place(to)
        return Math.max(0, max[to]! - g)
      },
      share: (i, live) => (live(i) + g) / n,
      range: (r) => r,
    }
  })
}
