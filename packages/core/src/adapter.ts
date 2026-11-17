import type { Key } from './types'
import type { Plan, Virtualizer } from './virtualizer'

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
