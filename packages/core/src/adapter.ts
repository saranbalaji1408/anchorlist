import type { Key } from './types'
import type { Plan, Virtualizer, VirtualizerOptions } from './virtualizer'

/**
 * `v.plan(options)`, except before the list is attached when
 * `options.initialRect` is set: then the rows that fill `initialRect.height`
 * by `estimateSize` (default 48 px) from the `align` edge. The server render
 * and the hydration render therefore produce the same rows, and the engine
 * takes over on `attach()` (restoring `initialSnapshot`, if any, from there).
 *
 * Adapters call this instead of `v.plan()` in their render phase. Without
 * `initialRect` it is exactly `v.plan()`, so rows never mount before the
 * scroll container exists.
 */
export function initialPlan(v: Virtualizer, options: VirtualizerOptions): Plan {
  const p = v.plan(options)
  const h = options.initialRect?.height
  const n = options.count
  // A plan is only empty before attach or for an empty list.
  if (p.end >= p.start || !h || !n) return p
  const back = options.align === 'end'
  let i = back ? n : -1
  for (let px = 0; px < h && (back ? i > 0 : i < n - 1); ) {
    i += back ? -1 : 1
    px += options.estimateSize?.(i) ?? 48
  }
  return { start: back ? i : 0, end: back ? n - 1 : i, options }
}

/** A row kept mounted outside the planned range, from {@link keptRow}. */
export interface KeptRow {
  /** Index in the planned options. */
  readonly index: number
  /** Start in list space (from the list element's start, padding included), in px. */
  readonly start: number
}

/**
 * Focus preservation: where to keep the row with `key` (for example the row
 * containing focus) while it is outside `plan`, or `null` when it is inside
 * the range, unknown or not measured yet. Adapters render it out of flow
 * (`position: absolute` in the list, which is `position: relative`) at
 * `start`, before the planned rows when `index < plan.start` and after them
 * otherwise, so the framework never moves its DOM node (a move blurs it).
 *
 * The engine's index of `key` is the committed one; when `plan.options`
 * changed the list, the key is looked up in the new list (O(n), only then).
 */
export function keptRow(v: Virtualizer, plan: Plan, key: Key | null | undefined): KeptRow | null {
  const o = plan.options
  let i = v.indexOf(key!)
  // Not found (or no key): -1.
  if (i < 0 || i >= o.count || o.getKey(i) !== key) for (i = key == null ? 0 : o.count; i-- && o.getKey(i) !== key; );
  const r = (i < plan.start || i > plan.end) && i >= 0 && v.getItemRect(key!)
  if (!r) return null
  // Positions are the committed ones: list space starts before the committed first item's padding.
  const c = v.plan().options
  return { index: i, start: r.start - v.getItemRect(c.getKey(0))!.start + (c.paddingStart ?? 0) }
}
