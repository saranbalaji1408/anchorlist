# @anchorlist/core design

How the engine works, why it is built this way, and what it costs. API.md is the normative
contract; this file explains the internals.

## Goals

1. **Content does not move unless the user moves it.** Neither does the anchor item's pinned-side edge.
   It stays within 0.5 px through prepends, appends, trims, item and header resizes, cross-axis resizes,
   anchor removal and middle edits. Exceptions: the list is pinned, follow is requested, or the
   position is out of range.
2. **Either edge.** `align: 'end'` (chat) and `'start'` (feed) share one code path. No rule is
   bottom-only.
3. **Cheap updates.** A streaming update (same keys, the last item grows) is O(1) in the list size.
   Edge changes are O(k log n).
4. **Small.** The list entry (`createVirtualizer` + `elementScroller`) must stay at or below 4.5 kB
   gzip; the whole package at or below 6.5 kB.

## Layers

```
createVirtualizer ──► KeyMap (key → slot, edge diff)
       │          ──► SizeIndex (Fenwick tree, gap/padding)
       │          ──► SizeCache (sizes by key, LRU, stale)
       ▼
    Scroller  ◄── elementScroller (DOM, VERTICAL | HORIZONTAL axis)
              ◄── simulatedScroller (Node, deterministic)
```

The engine is 1-D. Every main-axis DOM property lives behind an `Axis` object used only by
`elementScroller`. Horizontal scrolling is a different `Axis`; RTL normalisation is not implemented
yet.

## Coordinates

- **Content space** runs from the start of the scroll content. The effective offset is
  `eff = scroller.offset() + pending`, where `pending` is a deferred correction held in a transform.
- `Scroller.measure(el)` and `listStart()` are relative to the viewport start, transforms included.
  Content position = measured + `eff`, which is the same with or without a pending transform.
- **List space** runs from the list element's start. Item `i` starts at `SizeIndex.offsetOf(i)`
  (padding and gaps included).

## The reconcile loop (`cycle`)

The loop runs from `commit()`, from `attach()`, from scroll and resize events, from the microtask
after `scrollToKey` / `scrollToEdge`, and from idle work:

1. **Measure** every mounted row and update `SizeIndex` and `SizeCache`.
2. **Write spacers:** the list padding is `offsetOf(start)` before and `total - end(end)` after.
3. **Read `listStart`** (one forced layout per pass).
4. **Restore** according to the mode, writing the offset (or `pending`).
5. **Check the range.** If the range for the current offset differs from the committed one, request a
   render (`host.render(sync)`) and stop. The next commit continues, still before paint. The loop
   gives up after 8 passes.
6. **Settle:** re-capture the item anchor from the measured layout, turn a non-pinning edge mode
   into an anchor, and notify (visible range, at-edge, edge triggers). Then schedule idle work.

Re-capturing at every settle keeps the anchor and its 4 fallbacks consistent with one measured
layout. Fallback deltas captured earlier went stale when items between the anchor and a fallback were
measured later; the fuzz test found this.

When the re-capture lands on the same anchor key, its *intended* delta is kept, and the fallbacks
are shifted with it, as long as the difference is at most `EPSILON` (0.25 px). That difference can
only be a skipped sub-threshold correction. Without this rule, skipped corrections add up over many
changes (also found by the fuzz test).

The residual therefore stays within ±0.25 px, and one change moves content by at most 0.5 px. A
larger difference means the restore was clamped (the position is unreachable), and the actual
position is adopted. A later change that makes room then does not "catch up" with a visible jump.

## Modes

```ts
type Mode =
  | { t: 0; e: Edge }                                         // edge; the shared EDGE object = pinned at align
  | { t: 1; k: Key; d: number; i: number; f: Point[] }        // item: key, edge delta, index, fallbacks
  | { t: 2; k: Key; a: ItemAlign; o: number; s: number; q: number } // target: align, offset, start time, quiet frames
```

- **Anchor edge.** The first item whose end is past the viewport start is the anchor. Its `align`-side
  edge is held at `d` px from the viewport start: the end edge for `'end'`, so a growing anchor grows
  upward like a chat bubble; the start edge for `'start'`.
- **Fallbacks** are ordered after, before, after, before (two on each side). If all are gone, index
  recapture uses the item now at the anchor's index (adjusted by edge shifts). An edge is never used
  as a fallback, so removing the anchor cannot jump to the bottom.
- **Unreachable positions** are adopted at settle (see above).

## Keys and diffs

`KeyMap` stores only `key → slot`, with `index = slot - base`. A prepend lowers `base` and writes k
entries; a trim deletes k entries. Surviving entries are never touched. Keys by index come from the
committed `getKey`; the previous `getKey` supplies the keys being trimmed. There is no reverse map.

`diff(count, getKey)`:

1. Find the new first key in the old map. If it is missing, scan forward over the prepended keys
   until a known key appears (O(k)). Do the same from the end.
2. The survivors `[a, b]` in old indices must line up with `[p, count - 1 - q]` in new indices.
   Otherwise the result is `REBUILD`.
3. Same edges and same count returns the shared `NO_CHANGE`: O(1), 2 `getKey` calls, no
   allocation. This is the streaming path.

Keys between the edges are not read. They are validated lazily, in two places:

- **on every commit**, for the rendered range (O(range)), with a rebuild on mismatch;
- **at idle**, for the whole list (O(n)), 300 ms after the last settled frame.

A rebuild is "remove all, add all", and reports only keys that really left, so a moved key keeps its
measured size.

## SizeIndex

- **Storage.** A Fenwick tree over a `Float64Array` of capacity `cap`. Items occupy slots
  `[base, base + n)`, and every other slot is 0, so `offsetOf(i) = padStart + prefix(base + i) + i * gap`
  needs no base correction.
- **Costs.** Prepend, append and trims touch only their k slots: O(k log cap). Growth re-allocates
  to `max(16, 2 × needed)`, re-centres the items and rebuilds the tree in O(cap). Alternating trims
  and appends (a sliding window) therefore never grow it without bound.
- **Search.** `findIndexAtOffset` descends the tree on `prefix(p) + p * gap`, which is monotone in p.
  It allows 1e-7 px of float residue that edge removals leave in the tree; rebuilds are exact.
- **Middle edits.** `spliceSizes` rebuilds in O(n).

## Size cache

The cache maps key → measured size and keeps the running sum for the average.

- **Removed keys** are deleted.
- **`maxCachedSizes`** evicts the least recently *measured* entry. Mounted rows are re-set on every
  pass, so they stay recent, and `get` stays a plain `Map.get`.
- **A cross-axis resize** marks every entry stale. Mounted rows are re-measured in the same callback.
  Unmounted entries remain usable as estimates and report `measured: false`.
- **Estimates** are the `estimateSize` option, or 48, which idle work replaces with the measured
  average when it drifts by more than 10%.

## plan() and commit()

- **`plan(options)` is read-only.** With `NO_CHANGE` it returns the range for the current offset.
  For an edge diff it returns the committed range shifted by `prepend - trimStart`, so every mounted
  row stays mounted and re-renders nothing. When pinned or following, the range moves to the pinned
  edge. Any rows that became reachable are added by the commit loop before paint (usually zero or
  one extra pass).
- **`commit(plan)`** applies the diff, then:
  - makes the follow decision (`follow`, default: stay pinned if pinned);
  - shifts the anchor index;
  - deletes removed keys from the cache;
  - validates the rendered keys;
  - writes `data-index` / `aria-posinset` / `aria-setsize`;
  - runs the loop.

## Events and browser timing

- **Event order.** Browsers clamp the scroll offset during layout and dispatch `scroll` before
  `ResizeObserver` callbacks. Both events therefore apply viewport and cross-axis changes first.
- **What counts as a user scroll.** An offset change that comes with a viewport change, or that
  lands on the end of content that shrank, is treated as a clamp. Any other offset change different
  from our last write is a user scroll, and it re-captures (or pins).
- **Order inside the scroll handler.** The movement check runs before a deferred correction is
  committed. Committing first would hide the movement; the overscroll test caught this.
- **Viewport resizes.** For `'end'`, a viewport resize shifts the anchor deltas by Δ, so content
  stays fixed relative to the bottom.
- **Deferral.** On touch WebKit during a touch or within 120 ms of a scroll, and whenever
  overscrolled, corrections go into `pending` and a transform on the content wrapper.
  `scrollend`, a 120 ms idle timer, or the end of an overscroll commits them. Edge triggers are
  suppressed while overscrolled.
- **Target lock.** `scrollToKey` positions immediately and re-aligns on every measurement. One
  animation-frame callback counts quiet frames (2 needed, 500 ms cap) and never writes the offset.
  `touchstart`, `wheel` or a user scroll cancel the lock.

## Testing

| Suite | What it checks |
| --- | --- |
| `sizeIndex.test.ts` | Property test against a naive array: prepend, append, trims, set, splice, reset, layout, random probes. Also sliding-window boundedness. |
| `keyMap.test.ts` | Property test over random edge, middle, swap and replace edits. After each edit, validate plus rebuild must give exact indices, and only departed keys may be reported removed. O(k) and O(1) call counts. |
| `sizeCache.test.ts` | Average, stale marking, LRU, and a property test of the average. |
| `scroller.test.ts` | `isTouchWebKit`, both axes, `elementScroller` against fake elements, the simulator layout and event order. |
| `virtualizer.test.ts` | Behaviour for both aligns: follow, anchor removal, `scrollToKey` lock and cancel, edges, edge triggers, overscroll and touch deferral, cross-axis remeasure, gap and padding, estimate refresh, rebuild, aria, snapshots. |
| `engine.fuzz.test.ts` | 18 operation types, seeded. 3 variants (plain, gap + padding, touch WebKit with random touches) × 2 aligns. `FUZZ_ITERATIONS` (default 1500), `FUZZ_SEED`, `FUZZ_LOG`, `FUZZ_TRACE`. |
| `engine.perf.test.ts` | Opt-in 100k bench (`pnpm --filter @anchorlist/core bench`). |

The fuzz invariant: after each operation, the anchor's `align`-side edge (from `getSnapshot()`) is
within 0.5 px of where it was, with these exceptions:

- the operation scrolled on purpose;
- the anchor was removed;
- the needed effective offset is outside `[0, max]`. For a viewport change this is judged on the
  geometry before the change.

If the list was pinned, it must still be at the edge.

Result: `FUZZ_ITERATIONS=10000` with the 20 odd seeds 1–39, 6 configurations each, ran 1.2M
operations and 921,706 drift checks with 0 failures. A 10k run of all 6 configurations takes
about 8 s on an Apple M2; the default (1500) takes about 1 s.

## Performance (100k items, Apple M2, Node 24, simulated scroller)

Times include the minimal test host, which renders about 30 rows. A framework adds its own cost.

| Metric | Result |
| --- | --- |
| Mount, to the first settled frame | 32–36 ms |
| **Streaming update** (plan + commit + resize callback) | p50 9.5–11.6 µs, mean 17–26 µs, p95 30–41 µs (target < 50 µs) |
| Scroll frame (37 px per frame) | p50 14–16 µs, p95 44–48 µs |
| 50-item prepend while anchored | p50 70–90 µs, p95 207–239 µs |
| Heap after 100 prepend + trim cycles (constant count, after GC) | +125 KiB (flat; no per-cycle growth) |
| Idle: estimate refresh + key validation | 19–28 ms |
| Idle: key validation only | 10–11 ms |
| Middle insert (rebuild) | 27–39 ms |

These are ranges over 3 runs (`pnpm --filter @anchorlist/core bench`).

## Size (size-limit, min + gzip)

| Entry | Size | Budget |
| --- | --- | --- |
| `{ createVirtualizer, elementScroller }` | 4494 B | 4500 B |
| everything (`*`) | 5537 B | 6500 B |

The list entry has 6 B of headroom, so any engine addition must remove bytes elsewhere.
Size-driven choices:

- one `Plan` object instead of a side table;
- a shared `EDGE` mode object;
- no reverse key map;
- no memo in `plan()` (it is O(1) on the streaming path);
- no border compensation;
- one shared DOM listener;
- mode objects with one-letter fields.

## Known limits and risks

- **Idle O(n) work.** Full key validation and estimate refresh at idle take ~10–28 ms at 100k items,
  in one task. They are fine at 10k (≈ 1–3 ms); chunking them is future work. A middle edit rebuilds
  in O(n) (≈ 40 ms at 100k).
- **`getKey` must be a snapshot.** Trims read old keys through the previous `getKey`. A host that
  mutates the item array in place would delete the wrong cache entries. Validation then rebuilds the
  map, but measurements may be lost.
- **No border compensation.** Main-axis borders on the scroll container or the list shift the
  visible range by the border width.
- **Long touches** can accumulate large deferred corrections (thousands of px) in the transform. They
  are committed when the touch ends and is idle. The visual position is correct throughout, but very
  large transforms are untested on real devices.
- **Not in v0.1:** window scroller, RTL, lanes, sticky items, smooth scrolling to unmounted rows, and
  SSR `initialRect`.
