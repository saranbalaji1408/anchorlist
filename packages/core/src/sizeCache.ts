import type { Key } from './types'

/** Measured sizes by key, so measurements survive prepends and trims. */
export interface SizeCache {
  /** Cached size of `key`, or `undefined`. O(1), no reordering. */
  get(key: Key): number | undefined
  /**
   * Stores a measured size, clears its stale mark and makes it the most
   * recent entry. Beyond `max(max, floor)` entries, evicts the least recently
   * measured one. The virtualizer passes the mounted row count as `floor` and
   * re-measures mounted rows on every pass, so they are never evicted.
   */
  set(key: Key, size: number, floor?: number): void
  /** Removes `key` (the item left the list). */
  delete(key: Key): void
  /** Marks every entry stale (the cross axis changed). Values stay usable as estimates. */
  markStale(): void
  /** True when `key` was measured since the last {@link SizeCache.markStale}. */
  isFresh(key: Key): boolean
  /** Average measured size, or `undefined` when nothing is cached. */
  average(): number | undefined
}

/**
 * Creates a {@link SizeCache}. With `max`, the cache keeps at most that many
 * entries and evicts the least recently measured one (Map insertion order).
 */
export function createSizeCache(max: number = Infinity): SizeCache {
  const sizes = new Map<Key, number>()
  let stale = new Set<Key>()
  let sum = 0

  const remove = (key: Key): void => {
    const s = sizes.get(key)
    if (s === undefined) return
    sum -= s
    sizes.delete(key)
    stale.delete(key)
  }

  return {
    get: (key) => sizes.get(key),
    set(key, size, floor = 0) {
      remove(key)
      sizes.set(key, size)
      sum += size
      if (sizes.size > Math.max(max, floor)) remove(sizes.keys().next().value as Key)
    },
    delete: remove,
    markStale() {
      stale = new Set(sizes.keys())
    },
    isFresh: (key) => sizes.has(key) && !stale.has(key),
    average: () => (sizes.size ? sum / sizes.size : undefined),
  }
}
