import type { Key } from './types'
import type { Plan, Virtualizer } from './virtualizer'

/** A row kept mounted outside the planned range, from {@link keptRow}. */
export interface KeptRow {
  /** Index in the planned options. */
  readonly index: number
  /** Start in content space (from the start of the scroll content, like `getItemRect`), in px. */
  readonly start: number
  /**
   * Start in list space (from the main-axis start edge of the list's border
   * box), in px. Equal to `start` minus the list's own start; with any
   * scroller (`windowScroller` too) it is where the row sits inside the list.
   */
  readonly offset: number
}

/**
 * Focus preservation: where to keep the row with `key` (for example the row
 * containing focus) while it is outside `plan`, or `null` when it is inside
 * the range, unknown or not measured yet. Adapters render it out of flow
 * (`position: absolute`, with the list as its containing block:
 * `position: relative` on the list) at `top: offset` (`inset-inline-start`
 * when horizontal), before the planned rows when `index < plan.start` and
 * after them otherwise, so the framework never moves its DOM node (a move
 * blurs it). `offset` stays correct when the list does not start at the
 * scroll content's start, for example below a page header with `windowScroller`.
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
  // Item 0 starts at paddingStart in list space, which gives the list's own start. Before
  // a change at index 0 is committed, fall back to content space for that one render.
  const k0 = o.getKey(0)
  const r0 = !v.indexOf(k0) && v.getItemRect(k0)
  return r ? { index: i, start: r.start, offset: r0 ? r.start - r0.start + (o.paddingStart ?? 0) : r.start } : null
}
