import type { Key } from './types'

/**
 * How a list changed between two `count` + `getKey` snapshots.
 *
 * An edge diff removes `trimStart` items from the start and `trimEnd` from the
 * end, then adds `prepend` items before and `append` after the survivors. When
 * `rebuild` is true the edge counts are meaningless and every key is re-read.
 */
export interface KeyDiff {
  /** Items removed from the start. */
  readonly trimStart: number
  /** Items removed from the end. */
  readonly trimEnd: number
  /** Items added before the survivors. */
  readonly prepend: number
  /** Items added after the survivors. */
  readonly append: number
  /** True when the change is not an edge change and the map must be rebuilt. */
  readonly rebuild: boolean
}

/** The diff for an unchanged list. Shared, so the streaming path allocates nothing. */
export const NO_CHANGE: KeyDiff = {
  trimStart: 0,
  trimEnd: 0,
  prepend: 0,
  append: 0,
  rebuild: false,
}

/**
 * Key → index map. Each key owns a slot and `index = slot - base`, so changes
 * at either edge never touch the entries of the surviving keys. Keys by index
 * come from `getKey`, so there is no reverse map to maintain.
 */
export interface KeyMap {
  /** Number of keys. */
  readonly count: number
  /** Index of `key`, or -1. O(1). */
  indexOf(key: Key): number
  /**
   * Diffs the stored keys against `count` + `getKey`. Pure. O(k) for k items
   * added or removed at the edges, O(1) when both edges are unchanged. Keys
   * between the edges are assumed unchanged: check them with {@link KeyMap.validate}.
   */
  diff(count: number, getKey: (index: number) => Key): KeyDiff
  /**
   * Applies a diff from {@link KeyMap.diff}. `oldKey` returns keys of the
   * list before the change (used for trimmed items). `removed` is called for
   * every key that is no longer present.
   */
  apply(
    diff: KeyDiff,
    count: number,
    getKey: (index: number) => Key,
    oldKey: (index: number) => Key,
    removed: (key: Key) => void,
  ): void
  /** True when `getKey(i)` is stored at index `i` for every `i` in `[from, to]`. */
  validate(from: number, to: number, getKey: (index: number) => Key): boolean
}

/** The diff for a change that is not an edge change. */
export const REBUILD: KeyDiff = { ...NO_CHANGE, rebuild: true }

/** Creates an empty {@link KeyMap}. */
export function createKeyMap(): KeyMap {
  let slots = new Map<Key, number>()
  let base = 0
  let n = 0

  const indexOf = (key: Key): number => (slots.get(key) ?? base - 1) - base
  const edges = (trimStart: number, trimEnd: number, prepend: number, append: number): KeyDiff => ({
    trimStart,
    trimEnd,
    prepend,
    append,
    rebuild: false,
  })

  return {
    get count() {
      return n
    },
    indexOf,
    diff(count, getKey) {
      if (!n || !count) return n ? edges(n, 0, 0, 0) : count ? edges(0, 0, 0, count) : NO_CHANGE
      let p = 0
      let a = indexOf(getKey(0))
      while (a < 0 && ++p < count) a = indexOf(getKey(p))
      if (a < 0) return REBUILD
      let q = 0
      let b = indexOf(getKey(count - 1))
      while (b < 0) b = indexOf(getKey(count - 1 - ++q))
      if (b < a || b - a !== count - 1 - q - p) return REBUILD
      return a || p || q || b !== n - 1 ? edges(a, n - 1 - b, p, q) : NO_CHANGE
    },
    apply(diff, count, getKey, oldKey, removed) {
      const gone: Key[] = []
      if (diff.rebuild) {
        slots.forEach((_, key) => gone.push(key))
        slots = new Map()
        diff = edges(0, 0, 0, count)
        n = 0
      } else {
        for (let i = 0; i < diff.trimStart; i++) gone.push(oldKey(i))
        for (let i = 1; i <= diff.trimEnd; i++) gone.push(oldKey(n - i))
        gone.forEach((key) => slots.delete(key))
        base += diff.trimStart
        n -= diff.trimStart + diff.trimEnd
      }
      base -= diff.prepend
      for (let i = 0; i < diff.prepend; i++) slots.set(getKey(i), base + i)
      n += diff.prepend
      for (let i = 0; i < diff.append; i++) slots.set(getKey(n + i), base + n + i)
      n += diff.append
      gone.forEach((key) => slots.has(key) || removed(key))
    },
    validate(from, to, getKey) {
      for (let i = Math.max(0, from); i <= to && i < n; i++) if (slots.get(getKey(i)) !== base + i) return false
      return true
    },
  }
}
