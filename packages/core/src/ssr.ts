import type { Plan, Virtualizer, VirtualizerOptions } from './virtualizer'

/**
 * Server rendering: pass it as the `initialPlan` option together with
 * `initialRect`. It is `v.plan(options)`, except before the list is attached:
 * then the rows that fill `initialRect.height` by `estimateSize` (default
 * 48 px), forwards from the `initialSnapshot` item when it is still at its
 * index, else from the `align` edge. The server render and the hydration
 * render therefore produce the same rows (no mismatch), and the engine takes
 * over on `attach()`, restoring the snapshot exactly.
 *
 * Vertical lists only for now (reads `height`). The server markup has no
 * spacers and no scroll offset, so before hydration the rows sit at the top.
 */
export function initialPlan(v: Virtualizer, options: VirtualizerOptions): Plan {
  const p = v.plan(options)
  // A plan is only empty before attach or for an empty list (then the loop adds nothing).
  if (p.end >= p.start) return p
  const n = options.count
  const h = options.initialRect?.height ?? 0
  const s = options.initialSnapshot
  const at = s && !s.pinned && s.index >= 0 && s.index < n && options.getKey(s.index) === s.key ? s.index : -1
  const back = at < 0 && options.align === 'end'
  const from = back ? n - 1 : Math.max(at, 0)
  let k = 0
  for (let px = 0; px < h && k < (back ? n : n - from); k++) px += options.estimateSize?.(back ? from - k : from + k) ?? 48
  return back ? { start: n - k, end: from, options } : { start: from, end: from + k - 1, options }
}
