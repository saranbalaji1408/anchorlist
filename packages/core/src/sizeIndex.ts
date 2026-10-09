/**
 * Prefix sums of item sizes along the main axis, with gap and padding.
 *
 * Positions are in list space: `offsetOf(0)` is `paddingStart`, and item `i`
 * starts at `paddingStart + sum(size(0..i-1)) + i * gap`.
 */
export interface SizeIndex {
  /** Number of items. */
  readonly count: number
  /** Size of item `index`, or 0 when out of bounds. O(1). */
  size(index: number): number
  /** Sets the size of item `index` (negative sizes are stored as 0). O(log n). */
  setSize(index: number, size: number): void
  /** Start offset of item `index`, for `0 <= index <= count`. O(log n). */
  offsetOf(index: number): number
  /**
   * Largest index whose start offset is `<= offset`, clamped to
   * `[0, count - 1]`. Returns -1 when empty. O(log n).
   */
  findIndexAtOffset(offset: number): number
  /** Total list size: padding, every item and the gaps between them. O(1). */
  total(): number
  /** Adds `k` items before index 0. `sizeAt(i)` receives the new index. O(k log n). */
  prepend(k: number, sizeAt: (index: number) => number): void
  /** Adds `k` items after the last one. `sizeAt(i)` receives the new index. O(k log n), O(k) when empty. */
  append(k: number, sizeAt: (index: number) => number): void
  /** Removes the first `k` items (`k <= count`). O(k log n). */
  trimStart(k: number): void
  /** Removes the last `k` items (`k <= count`). O(k log n). */
  trimEnd(k: number): void
  /** Replaces every item. O(n). */
  reset(count: number, sizeAt: (index: number) => number): void
  /** Sets the gap between items and the padding before the first and after the last item (each default 0). O(1). */
  setLayout(gap?: number, paddingStart?: number, paddingEnd?: number): void
}

/**
 * Creates a {@link SizeIndex}: a Fenwick tree over a two-ended
 * `Float64Array`. Items live in slots `[base, base + count)`; every slot
 * outside that window is 0, so prefix sums need no base correction and edge
 * changes only touch the affected slots. The arrays grow by doubling and
 * re-centre, so alternating trims and appends never grow them without bound.
 */
export function createSizeIndex(): SizeIndex {
  let cap = 0
  let base = 0
  let n = 0
  let sum = 0
  let gap = 0
  let padStart = 0
  let padEnd = 0
  let sizes = new Float64Array(0)
  let tree = sizes

  /** Sets slot `slot` to `size` (clamped at 0). */
  const put = (slot: number, size: number): void => {
    const s = size > 0 ? size : 0
    const d = s - sizes[slot]!
    if (!d) return
    sizes[slot] = s
    sum += d
    for (let j = slot + 1; j <= cap; j += j & -j) tree[j]! += d
  }
  /**
   * Re-allocates with `front` free slots before and `back` after the items,
   * fills them from `fill` (default: the current sizes) and rebuilds the tree
   * and the sum exactly in O(cap).
   */
  const alloc = (front: number, back: number, fill?: (i: number) => number): void => {
    const need = n + front + back
    const old = sizes.subarray(base, base + n)
    const at = fill ?? ((i: number): number => old[i]!)
    cap = Math.max(16, need * 2)
    base = front + ((cap - need) >> 1)
    sizes = new Float64Array(cap)
    sum = 0
    for (let i = 0; i < n; i++) sum += sizes[base + i] = Math.max(0, at(i))
    tree = new Float64Array(cap + 1)
    for (let i = 1; i <= cap; i++) {
      tree[i]! += sizes[i - 1]!
      const j = i + (i & -i)
      if (j <= cap) tree[j]! += tree[i]!
    }
  }
  const ensure = (front: number, back: number): void => {
    if (base < front || base + n + back > cap) alloc(front, back)
  }

  const index: SizeIndex = {
    get count() {
      return n
    },
    // Slots outside the items hold 0.
    size: (i) => sizes[base + i] ?? 0,
    setSize(i, size) {
      if (i >= 0 && i < n) put(base + i, size)
    },
    offsetOf(i) {
      let s = padStart + i * gap
      for (let j = base + i; j > 0; j -= j & -j) s += tree[j]!
      return s
    },
    findIndexAtOffset(offset) {
      if (!n) return -1
      // Largest slot p with prefix(p) + p * gap <= target (monotone in p). The
      // tolerance absorbs float residue left in the tree by edge removals.
      const target = offset - padStart + base * gap + 1e-7
      let pos = 0
      let step = 1
      while (step * 2 <= cap) step *= 2
      for (let acc = 0; step; step >>= 1) {
        const next = pos + step
        if (next <= cap && acc + tree[next]! + next * gap <= target) acc += tree[(pos = next)]!
      }
      return Math.min(Math.max(pos - base, 0), n - 1)
    },
    total: () => padStart + padEnd + (n ? sum + (n - 1) * gap : 0),
    prepend(k, sizeAt) {
      ensure(k, 0)
      base -= k
      n += k
      for (let i = 0; i < k; i++) put(base + i, sizeAt(i))
    },
    append(k, sizeAt) {
      if (!n) return index.reset(k, sizeAt)
      ensure(0, k)
      for (let i = 0; i < k; i++) put(base + n + i, sizeAt(n + i))
      n += k
    },
    trimStart(k) {
      for (let i = 0; i < k; i++) put(base + i, 0)
      base += k
      n -= k
    },
    trimEnd(k) {
      n -= k
      for (let i = 0; i < k; i++) put(base + n + i, 0)
    },
    reset(count, sizeAt) {
      n = count
      alloc(0, 0, sizeAt)
    },
    setLayout(g = 0, ps = 0, pe = 0) {
      gap = g
      padStart = ps
      padEnd = pe
    },
  }
  return index
}

/**
 * Removes `remove` items at `at` and inserts `insert` new ones there.
 * Edits touching an edge use the O(k log n) edge operations; middle edits
 * rebuild the index in O(n).
 */
export function spliceSizes(
  index: SizeIndex,
  at: number,
  remove: number,
  insert: number,
  sizeAt: (index: number) => number,
): void {
  const n = index.count
  at = Math.max(0, Math.min(at, n))
  remove = Math.max(0, Math.min(remove, n - at))
  if (!remove && !at) return index.prepend(insert, sizeAt)
  if (!remove && at === n) return index.append(insert, sizeAt)
  if (!insert && !at) return index.trimStart(remove)
  if (!insert && at + remove === n) return index.trimEnd(remove)
  const old: number[] = []
  for (let i = 0; i < n; i++) old.push(index.size(i))
  index.reset(n - remove + insert, (i) => (i < at ? old[i]! : i < at + insert ? sizeAt(i) : old[i - insert + remove]!))
}
