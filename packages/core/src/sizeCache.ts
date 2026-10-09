import type { Key } from './types'

/** Measured sizes by key, so measurements survive prepends and trims. */
export interface SizeCache {
  /** Number of cached sizes. */
  readonly size: number
  /** Cached size of `key`, or `undefined`. O(1), no reordering. */
  get(key: Key): number | undefined
  /**
   * Stores a measured size, clears its stale mark and makes it the most
   * recent entry. Beyond `max`, evicts the least recently measured entry
   * (mounted rows are re-measured on every pass, so they stay recent).
   */
  set(key: Key, size: number): void
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
    get size() {
      return sizes.size
    },
    get: (key) => sizes.get(key),
    set(key, size) {
      remove(key)
      sizes.set(key, size)
      sum += size
      if (sizes.size > max) remove(sizes.keys().next().value as Key)
    },
    delete: remove,
    markStale() {
      stale = new Set(sizes.keys())
    },
    isFresh: (key) => sizes.has(key) && !stale.has(key),
    average: () => (sizes.size > 0 ? sum / sizes.size : undefined),
  }
}
