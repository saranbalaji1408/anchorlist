import type { Key } from './types'
import type { Plan, Virtualizer, VirtualizerOptions } from './virtualizer'

/**
 * `v.plan(options)`, except before the list is attached when
 * `options.initialRect` is set: then the rows that fill `initialRect.height`
 * by `estimateSize` (default 48 px) from the `align` edge. The server render
 * and the hydration render therefore produce the same rows, and the engine
 * takes over on `attach()`. An `initialSnapshot` is restored from there, so
 * the server HTML shows the `align` edge until hydration.
 *
 * Adapters call this instead of `v.plan()` in their render phase. Without
 * `initialRect` it is exactly `v.plan()`, so rows never mount before the
 * scroll container exists. Vertical lists only for now (reads `height`).
 */
export function initialPlan(v: Virtualizer, options: VirtualizerOptions): Plan {
  const p = v.plan(options)
  const n = options.count
  const back = options.align === 'end'
  let k = 0
  // A plan is only empty before attach or for an empty list (then nothing is added).
  if (p.end < p.start)
    for (let px = 0; px < (options.initialRect?.height ?? 0) && k < n; k++) px += options.estimateSize?.(back ? n - 1 - k : k) ?? 48
  return k ? (back ? { start: n - k, end: n - 1, options } : { start: 0, end: k - 1, options }) : p
}

/** A row kept mounted outside the planned range, from {@link keptRow}. */
export interface KeptRow {
  /** Index in the planned options. */
  readonly index: number
  /** Start in content space (from the start of the scroll content, like `getItemRect`), in px. */
  readonly start: number
}

/**
 * Focus preservation: where to keep the row with `key` (for example the row
 * containing focus) while it is outside `plan`, or `null` when it is inside
 * the range, unknown or not measured yet. Adapters render it out of flow
 * (`position: absolute`, with the scroll container as its containing block:
 * `position: relative` on the container, none between it and the row) at
 * `top: start`, before the planned rows when `index < plan.start` and after
 * them otherwise, so the framework never moves its DOM node (a move blurs it).
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
  // The committed position: content space is the scroll container's scrolled padding box.
  return r ? { index: i, start: r.start } : null
}
