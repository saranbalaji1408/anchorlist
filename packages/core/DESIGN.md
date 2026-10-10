# @anchorlist/core design

How the engine works, why it is built this way, and what it costs. API.md is the normative
contract; this file explains the internals.

## Goals

1. **Content does not move unless the user moves it.** Neither does the anchor item's pinned-side edge.
   It stays put through prepends, appends, trims, item and header resizes, cross-axis resizes,
   anchor removal and middle edits: exact with sub-pixel offsets, and with whole-pixel offsets
   (DPR 1) ≤ 0.5 px per painted change and ≤ 1 px overall. Exceptions: the list is pinned, follow
   is requested, or the position is out of range.
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

1. **Adopt user movement** (`adopt`, below).
2. **Measure** every mounted row and update `SizeIndex` and `SizeCache`.
3. **Write spacers:** the list padding is `offsetOf(start)` before and `total - end(end)` after.
4. **Read `listStart`** (one forced layout per pass).
5. **Restore** according to the mode, writing the offset (or `pending`).
6. **Check the range.** If the range for the current offset differs from the committed one, request a
   render (`host.render(sync)`) and stop. The next commit continues, still before paint. The loop
   gives up after 8 passes.
7. **Settle:**
   - re-capture the item anchor from the measured layout;
   - turn a non-pinning edge mode into an anchor;
   - record the remainder to carry (below);
   - notify (visible range, at-edge, edge triggers);
   - schedule idle work.

## Intended position, whole pixels and carry

Browsers store scroll offsets in whole pixels at DPR 1. Chromium and Firefox round; WebKit truncates.
Rows have fractional sizes, so most corrections cannot be exact. The engine works with two offsets:

- **`err`** is the actual effective offset minus the *intended* one. Every write reads the offset
  back, so `err` records whatever the engine did. A browser clamp (content shrank under the
  offset) also goes into `err`.
- **Captures use the intended frame** (`eff - err`). An anchor's `d` is therefore its intended
  position, independent of rounding, and the error cannot accumulate across anchors or passes.
- **`write()` rounds itself** (`Math.round`), so truncating engines behave like rounding ones.
- **Carry.** An item anchor's write is `desired + carry`, clamped to the scroll range. `carry` is
  `err` at the last *painted* (settled) frame, clamped to ±0.5. A change then moves content by at
  most one rounding (≤ 0.5 px) from where it was painted. The error stays within 1 px: once it
  exceeds 0.5 px, the clamp pulls it back.

  `carry` is refreshed at settle and by a deferred commit, never between passes, so it cannot
  compound within one operation. Targets (`scrollToKey`) and edges are written exactly.

Guarantee, at DPR 1:

- each painted change moves content at most 0.5 px, or at most 1 px when the error before it already
  exceeded 0.5 px;
- the content never ends more than 1 px from its intended position.

Exactly 0.5 px on both counts is impossible with whole-pixel offsets and fractional sizes. At DPR 2
the steps halve.

## User movement (`adopt`)

At the start of every commit and pass, and on every `scroll` event:

- An offset change since our last write or observation is user movement. A clamp is excluded: our
  last offset is past the new end and the offset sits on it.
- It is detected in the loop, not only in the scroll handler, because a re-render can commit before
  the `scroll` event arrives. The browser scenario is `scroll.spec.ts › user movement`.
- At the `align` edge it pins.
- Otherwise, an item anchor is shifted by the movement (from its actual position, so `err` resets).
  A change in the same commit, such as a prepend, is therefore still compensated.
- Other modes re-anchor from model positions, because the DOM may already show the new rows.
- In the `scroll` handler the DOM is still the committed one, so the anchor is re-captured where the
  user is immediately. Without this, a long scroll left the anchor off-screen, and rows measured
  above it pushed the view back.

## Modes

```ts
type Mode =
  | { t: 0; e: Edge }                                         // edge; the shared EDGE object = pinned at align
  | { t: 1; k: Key; d: number; f: Point[] }                   // item: key, intended edge delta, fallbacks
  | { t: 2; k: Key; a: ItemAlign; o: number; s: number; q: number } // target: align, offset, start time, quiet frames
```

- **Anchor edge.** The first item whose end is past the viewport start is the anchor. Its `align`-side
  edge is held at `d` px from the viewport start: the end edge for `'end'`, so a growing anchor grows
  upward like a chat bubble; the start edge for `'start'`.
- **Fallbacks.** These are computed only when a diff may remove the anchor, from the model layout
  before the change, at distances 1, 2, 4, … to the list edge: after the anchor first, then before
  it.
  - Rows on one side of a removed run move together. Holding any surviving later row therefore keeps
    every row after the gap still, for both aligns. If nothing after survives, the rows before the
    gap hold. Cost: O(log n) points.
- **Reset.** If no point survives (the list was cleared or replaced), the mode resets to the `align`
  edge, like a fresh mount. While the list is empty the mode is kept, so `initialSnapshot` survives
  an attach before the first commit.
- **Clamped positions.** A clamped (unreachable) position is adopted: the clamped target becomes the
  intended one. A later change that makes room then does not "catch up" with a visible jump.

## Keys and diffs

`KeyMap` stores only `key → slot`, with `index = slot - base`. A prepend lowers `base` and writes k
entries; a trim deletes k entries. Surviving entries are never touched. Keys by index come from the
committed `getKey`; the previous `getKey` supplies the keys being trimmed. There is no reverse map.

`diff(count, getKey)`:

1. Find the new first key in the old map. If it is missing, scan forward over the prepended keys
   until a known key appears (O(k)). Do the same from the end. A first load (empty map) is a
   `REBUILD`, which is O(n) anyway.
2. The survivors `[a, b]` in old indices must line up with `[p, count - 1 - q]` in new indices.
   Otherwise the result is `REBUILD`.
3. Same edges and same count returns the shared `NO_CHANGE`: O(1), 2 `getKey` calls, no
   allocation. This is the streaming path.

Keys between the edges are not read. They are validated lazily, in two places:

- **on every commit**, for the rendered range (O(range)), with a rebuild on mismatch;
- **at idle**, for the whole list (O(n)), 300 ms after the last settled frame.

A rebuild is "remove all, add all", and reports only keys that really left, so a moved key keeps its
measured size. If the keys still do not validate after a rebuild, they are duplicated. Lazy
validation is then off until the list changes again, so duplicates cost one rebuild per change, not
one per commit.

## SizeIndex

- **Storage.** A Fenwick tree over a `Float64Array` of capacity `cap`. Items occupy slots
  `[base, base + n)`, and every other slot is 0, so `offsetOf(i) = padStart + prefix(base + i) + i * gap`
  needs no base correction.
- **Costs.** Prepend, append and trims touch only their k slots: O(k log cap). Growth re-allocates
  to `max(16, 2 × needed)`, re-centres the items and rebuilds the tree and the sum exactly in
  O(cap). Alternating trims and appends (a sliding window) therefore never grow it without bound.
- **Search.** `findIndexAtOffset` descends the tree on `prefix(p) + p * gap`, which is monotone in p.
  It allows 1e-7 px of float residue that edge removals leave in the tree.
- **Middle edits.** `spliceSizes` rebuilds in O(n).

## Size cache

The cache maps key → measured size and keeps the running sum for the average.

- **Removed keys** are deleted.
- **`maxCachedSizes`** evicts the least recently *measured* entry. Mounted rows are re-set on every
  pass with the mounted count as a floor, so they are never evicted, even when `maxCachedSizes` is
  smaller than the mounted count. `get` stays a plain `Map.get`.
- **A cross-axis resize** marks every entry stale. Mounted rows are re-measured in the same callback.
  Unmounted entries remain usable as estimates and report `measured: false`.
- **Estimates** are the `estimateSize` option, or 48. When the measured average drifts by more than
  10%, idle work rebuilds the index with it (O(n)).

## plan() and commit()

- **`plan(options)` is read-only.** With `NO_CHANGE` it returns the range for the current offset.
  For an edge diff it returns the committed range shifted by `prepend - trimStart`, so every mounted
  row stays mounted and re-renders nothing. When pinned or following, the range moves to the pinned
  edge. Any rows that became reachable are added by the commit loop before paint (usually zero or
  one extra pass).
- **`commit(plan)`:**
  - adopts user movement;
  - takes fallbacks;
  - applies the diff and makes the follow decision (`follow`, default: stay pinned if pinned);
  - deletes removed keys from the cache;
  - validates the rendered keys;
  - writes `data-index` / `aria-posinset` / `aria-setsize`;
  - runs the loop.

## Events and browser timing

- **Event order.** Browsers clamp the scroll offset during layout and dispatch `scroll` before
  `ResizeObserver` callbacks. Both events therefore apply viewport and cross-axis changes first. The
  offset change that comes with a viewport change is treated as a clamp.
- **Viewport resizes.** For `'end'`, a viewport resize shifts the anchor delta by Δ, so content stays
  fixed relative to the bottom.
- **Deferral.** On touch WebKit during a touch or within 120 ms of any scroller event, and whenever
  overscrolled, corrections go into `pending` and a transform on the content wrapper.
  - A 120 ms idle timer, or the end of an overscroll, commits them. No `scrollend` listener is
    needed.
  - Edge triggers are suppressed while overscrolled.
- **Target lock.** `scrollToKey` positions immediately and re-aligns on every measurement. One
  animation-frame callback counts quiet frames (2 needed, 500 ms cap from its first frame) and never
  writes the offset. `touchstart`, `wheel` or any user scroll cancel the lock.

## Testing

| Suite | What it checks |
| --- | --- |
| `sizeIndex.test.ts` | Property test against a naive array: prepend, append, trims, set, splice, reset, layout, random probes. Also sliding-window boundedness. |
| `keyMap.test.ts` | Property test over random edge, middle, swap and replace edits. After each edit, validate plus rebuild must give exact indices, and only departed keys may be reported removed. O(k) and O(1) call counts. |
| `sizeCache.test.ts` | Average, stale marking, LRU, and a property test against a reference. |
| `scroller.test.ts` | `isTouchWebKit`, both axes, `elementScroller` against fake elements, the simulator layout and event order. |
| `virtualizer.test.ts` | Behaviour for both aligns, including: follow; anchor removal; `scrollToKey` lock and cancel; edges and edge triggers; overscroll and touch deferral; cross-axis remeasure; gap and padding; estimate refresh; rebuild; aria; snapshots; user movement before the `scroll` event; state without callbacks; whole-pixel per-change and absolute bounds (rounding and truncating engines); clear and replace; holding the rows after a gap; `getSnapshot` without a scroller; duplicate keys; `maxCachedSizes` below the mounted count. |
| `engine.fuzz.test.ts` | 20 operation types, seeded. 5 variants × 2 aligns: plain, gap + padding, touch WebKit with random touches, whole pixels with rounding, and whole pixels with truncation. `FUZZ_ITERATIONS` (local default 1500; CI runs 10,000 per configuration), `FUZZ_SEED`, `FUZZ_LOG`, `FUZZ_TRACE`. |
| `engine.perf.test.ts` | Opt-in 100k bench (`pnpm --filter @anchorlist/core bench`). |

The 20 operation types:

- list changes: prepend, append, both trims, trim+append, trim+prepend, middle insert, middle delete,
  and anchor delete;
- sizes: item resize, streaming growth, header resize, cross-axis resize, viewport resize;
- other: idle time, user scroll, "user scroll then re-render before its scroll event",
  `scrollToKey`, `scrollToEdge`, and touch start/end.

Invariants after each operation:

- **Anchor.** Its `align`-side edge moves at most 1 px from where it actually was, and ends at most
  1 px from its intended position (`getSnapshot().delta`). One operation can span several painted
  changes; the strict 0.5 px per change is a unit test.
- **Removed anchor.** The nearest surviving row after the gap, else before it, must hold, probed at
  distances 1–8, 16, 32, … including unmounted rows. If nothing survives, the list must be at the
  `align` edge.
- **Pinned.** It must still be at the edge.
- **Commands.** `scrollToKey` leaves its key aligned once settled, and `scrollToEdge` reaches its
  edge.
- **Exemptions:** positions that need an offset outside `[0, max]`; a viewport change, judged on the
  geometry before it; a user scroll ending at the `align` edge (it pins); and movement lost to a
  clamp during the render, before any engine code runs.

Result: `FUZZ_ITERATIONS=10000` with seeds 1–19 (odd) × 10 configurations ran 1M operations and
856,362 checks with 0 failures. A 10k run of all 10 configurations takes about 6 s on an Apple M2;
the default takes about 1 s.

## Performance (100k items, Apple M2, Node 24, simulated scroller)

Times include the minimal test host, which renders about 30 rows. A framework adds its own cost.

| Metric | Result |
| --- | --- |
| Mount, to the first settled frame | 20–27 ms |
| **Streaming update** (plan + commit + resize callback) | p50 6.9–7.1 µs, mean 8.3–8.9 µs, p95 12–13 µs (target < 50 µs) |
| Scroll frame (37 px per frame) | p50 ≈ 11 µs, p95 19–21 µs |
| 50-item prepend while anchored | p50 43–46 µs, p95 69–71 µs |
| Heap after 100 prepend + trim cycles (constant count, after GC) | +161 KiB (flat; no per-cycle growth) |
| Idle: estimate refresh + key validation | 9–9.3 ms |
| Idle: key validation only | 4.2–4.9 ms |
| Middle insert (rebuild) | 15–16 ms |

These are ranges over 3 runs (`pnpm --filter @anchorlist/core bench`).

## Size (size-limit, min + gzip)

| Entry | Size | Budget |
| --- | --- | --- |
| `{ createVirtualizer, elementScroller }` | 4497 B | 4500 B |
| everything (`*`) | 5577 B | 6500 B |
| React chat path (core + react) | 5367 B | 5800 B |

The list entry has 3 B of headroom, so any engine addition must remove bytes elsewhere.
Size-driven choices:

- one `Plan` object instead of a side table;
- a shared `EDGE` mode object;
- no reverse key map;
- no memo in `plan()` (it is O(1) on the streaming path);
- no border compensation;
- one shared DOM listener and no `scrollend` listener;
- mode objects with one-letter fields;
- fallbacks only on removal diffs;
- an optional `KeyDiff.rebuild`.

## Known limits and risks

- **Whole-pixel offsets.** See "Intended position, whole pixels and carry": ≤ 0.5 px per painted
  change, ≤ 1 px overall at DPR 1.
- **Idle O(n) work.** Full key validation (and estimate refresh) at idle take ~5–9 ms at 100k items,
  in one task. A middle edit rebuilds in O(n) (≈ 15 ms at 100k).
- **`getKey` must be a snapshot.** Trims read old keys through the previous `getKey`. A host that
  mutates the item array in place would delete the wrong cache entries. Validation then rebuilds the
  map, but measurements may be lost.
- **No border compensation.** Main-axis borders on the scroll container or the list shift the
  visible range by the border width.
- **Movement lost to a render-time clamp.** If a re-render shortens the content before the commit
  runs (new rows, old spacers) and the browser clamps the user's offset, the clamped part of the
  scroll is lost. The engine adopts what is left.
- **Long touches** can accumulate large deferred corrections (thousands of px) in the transform. They
  are committed when the touch ends and is idle. The visual position is correct throughout, but very
  large transforms are untested on real devices.
- **Not in v0.1:** window scroller, RTL, lanes, sticky items, smooth scrolling to unmounted rows, and
  SSR `initialRect`.
