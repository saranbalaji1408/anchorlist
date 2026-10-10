import type { Key } from './types'
import type { Snapshot, Virtualizer } from './virtualizer'

/**
 * `v.getSnapshot()` plus the measured sizes of up to `limit` items around the
 * anchor (indices `index - limit / 2` to `index + limit / 2`). Serializable.
 * Pass it back as `initialSnapshot`, with `estimateSize` from
 * {@link snapshotEstimate} so those items are laid out at their measured
 * sizes from the first frame.
 *
 * @param v - The virtualizer (or an adapter handle).
 * @param getKey - Key of the item at an index (the list's current items).
 * @param count - Number of items.
 * @param limit - Maximum number of items whose sizes are stored. Default 100.
 */
export function takeSnapshot(
  v: Pick<Virtualizer, 'getSnapshot' | 'getItemRect'>,
  getKey: (index: number) => Key,
  count: number,
  limit = 100,
): Snapshot {
  const snap = v.getSnapshot()
  const sizes: Array<readonly [Key, number]> = []
  const end = Math.min(count, Math.max(0, snap.index - (limit >> 1)) + limit)
  for (let i = Math.max(0, end - limit); i < end; i++) {
    const key = getKey(i)
    const r = v.getItemRect(key)
    if (r?.measured) sizes.push([key, r.size])
  }
  return { ...snap, sizes }
}

const maps = new WeakMap<object, Map<Key, number>>()

/**
 * An `estimateSize` option that answers the sizes stored by
 * {@link takeSnapshot}: restored items are laid out at their measured sizes
 * from the first frame (the anchor is restored either way; this keeps the
 * scroll range and the rows above it exact). Other items use `estimateSize`,
 * else the average stored size. Returns `estimateSize` when the snapshot has
 * no sizes.
 *
 * @param snapshot - The `initialSnapshot`.
 * @param getKey - Key of the item at an index (the list's current items).
 * @param estimateSize - Estimate for items without a stored size.
 */
export function snapshotEstimate(
  snapshot: Snapshot | undefined,
  getKey: (index: number) => Key,
  estimateSize?: (index: number) => number,
): ((index: number) => number) | undefined {
  const sizes = snapshot?.sizes
  if (!sizes?.length) return estimateSize
  let map = maps.get(sizes)
  if (!map) maps.set(sizes, (map = new Map(sizes)))
  const m = map
  const avg = sizes.reduce((a, s) => a + s[1], 0) / sizes.length
  return (i) => m.get(getKey(i)) ?? estimateSize?.(i) ?? avg
}
