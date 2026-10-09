# @anchorlist/core API

Normative reference for `@anchorlist/core` v0.1 and for framework adapters built on it. "Must" and
"must not" are requirements; an adapter that breaks one will show scroll jumps.

- [Model](#model)
- [Adapter contract](#adapter-contract)
- [DOM structure](#dom-structure)
- [createVirtualizer](#createvirtualizer)
- [Options](#options)
- [Virtualizer methods](#virtualizer-methods)
- [Scrollers](#scrollers)
- [Behaviour](#behaviour)
- [Data structures](#data-structures)
- [Types](#types)

## Model

The engine is 1-D. It owns every write to the scroll offset and keeps the viewport anchored to an
item **key** (not an index or a pixel offset). A frame works like this:

1. The host renders `plan(options)`: a contiguous, inclusive index range.
2. After the DOM update and before paint, the host calls `commit(plan)`. The engine diffs the keys,
   measures the mounted rows, writes the spacers, the `data-index` / `aria-*` attributes and the scroll
   offset, then checks the range.
3. If the range must change, the engine calls `host.render(...)` and the next commit continues, still
   before paint. A frame settles after at most 8 passes.

Scroll, resize and touch events go through the same loop. Corrections are never made in
`requestAnimationFrame`. The engine uses an animation frame only to count quiet frames for the
`scrollToKey` lock.

## Adapter contract

```ts
const v = createVirtualizer(options, { render: (sync) => (sync ? flushSync(rerender) : rerender()) })

// Render phase, on every render (pure, may run several times or be discarded):
const plan = v.plan(options)
// Render rows plan.start..plan.end (inclusive), keyed by options.getKey(i).

// After the DOM update and before paint (React: useLayoutEffect, no deps):
if (!attached) v.attach(elementScroller({ element, list, content })) // once, on the first commit
v.commit(plan)

// Row ref callback (stable per key):
ref = (el) => v.measureElement(el, key) // el is null on unmount

// Unmount:
v.destroy()
```

Requirements:

1. **Create once.** One virtualizer per list instance. `align`, `initialSnapshot` and `maxCachedSizes`
   are read at creation only.
2. **Plan in render.** Call `plan(options)` during render with the current options object. `plan()`
   never mutates the engine, so concurrent or discarded renders are safe. Before `attach()` it returns
   an empty range. Rows are therefore never mounted in the same commit as the scroll container, and
   row components can rely on the container existing.
3. **Commit before paint.** After every DOM commit that rendered a plan, call `commit(plan)` with that
   plan object, synchronously, before the browser paints (React `useLayoutEffect`, Vue
   `flush: 'post'` / `onUpdated`, Svelte 5 `$effect` + `flushSync`). Do not call it from
   `requestAnimationFrame`, `setTimeout` or a passive effect.
4. **Attach before the first positioning commit.** On the first commit, after the elements exist,
   call `attach(scroller)` and then `commit(plan)`. `attach()` runs the loop, which requests the first
   real render.
5. **`host.render(sync)`** must re-render and lead to `plan()` + `commit()`:
   - `sync: true` (from `scroll` events and from the microtask after `scrollToKey` / `scrollToEdge`).
     The host must render and commit **before `render` returns** (React `flushSync`). It is never
     called during a render or a commit.
   - `sync: false` (from inside `commit()` and from `ResizeObserver` callbacks). A normal state
     update is enough. Inside `commit()` (a layout effect) React flushes it before paint. From a
     resize callback it may land a frame later, and overscan covers that gap.
6. **Keyed rows, no index props.** Render each row keyed by its key. Do not pass the index to row
   components: the engine writes `data-index`, `aria-posinset` and `aria-setsize` itself, so a
   prepend re-renders no mounted rows.
7. **Ref per row.** Call `measureElement(el, key)` when a row mounts and `measureElement(null, key)`
   when it unmounts. Measurement is the row's border box on the main axis.
8. **Never write the scroll offset** and never style the list's main-axis padding. The engine owns
   both. Use `scrollToKey` / `scrollToEdge` and the `paddingStart` / `paddingEnd` options.
9. **Destroy on unmount.** `destroy()` removes listeners and timers. The instance is unusable after.

Imperative calls (`scrollToKey`, `scrollToEdge`) are safe from any context, including effects: they
position immediately and run the loop in a microtask.

## DOM structure

```html
<div data-scroller style="overflow-y: auto; overflow-anchor: none">   <!-- elementScroller element -->
  <div data-content>                                                   <!-- optional `content` wrapper -->
    <header>…</header>                                                 <!-- optional, in normal flow -->
    <div data-list style="display: flex; flex-direction: column; gap: {gap}px">  <!-- `list` -->
      <div data-index="12" aria-posinset="13" aria-setsize="400">…</div>  <!-- rows plan.start..plan.end -->
      …
    </div>
    <footer>…</footer>
  </div>
</div>
```

- The list's direct children must be exactly the rows of the plan, in index order. Spacers are the
  list's main-axis padding (`paddingTop`/`paddingBottom`, or left/right when horizontal). The engine
  writes them.
- `overflow-anchor: none` on the scroller is required, otherwise the browser's own anchoring fights
  the engine.
- A row's size is its border box. Put margins inside the row (for example a flex column row) or use
  `gap`. The DOM gap must equal the `gap` option.
- Give the scroll container and the list no main-axis border. Borders are not compensated.
- The `content` wrapper (default: the list) receives deferred corrections as a `transform`. Wrap
  header, list and footer in it so they move together. Do not put your own transform on it.
- Header and footer may change size at any time. The anchor is DOM-measured, so this is
  compensated. Their resizes are observed through the content wrapper's `ResizeObserver`, so
  pass `content` whenever you render a header or footer.
- A sticky overlay (for example a date pill) can render from `getVisibleRange()` via `subscribe()`.
  Put it outside the content wrapper.

## createVirtualizer

```ts
function createVirtualizer(options: VirtualizerOptions, host: VirtualizerHost): Virtualizer
interface VirtualizerHost { render(sync: boolean): void }
```

## Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `count` | `number` | required | Item count. |
| `getKey` | `(index) => Key` | required | Unique, stable key (`string \| number`). Must describe the list at the time `plan()` was called, so use immutable snapshots. |
| `estimateSize` | `(index) => number` | 48, then the measured average | Used for unmeasured items. Without it, estimates are refreshed at idle when the average drifts by more than 10%. |
| `align` | `'start' \| 'end'` | `'start'` | Pinned edge. `'end'` for chat, `'start'` for feeds. Creation only. |
| `overscan` | `number` (px) | 400 | Rendered beyond each side of the viewport. |
| `gap` | `number` (px) | 0 | Between items. The DOM must use the same gap. |
| `paddingStart` / `paddingEnd` | `number` (px) | 0 | Before the first / after the last item, inside the list. |
| `hasMoreStart` / `hasMoreEnd` | `boolean` | false | More items can be loaded on that side. Disables pinning on that side and sets `aria-setsize="-1"`. |
| `startThreshold` / `endThreshold` | `number` (px) | 300 | Distance that triggers `onStartReached` / `onEndReached`. |
| `onStartReached` / `onEndReached` | `() => void` | none | See [Edge triggers](#edge-triggers). |
| `atEdgeThreshold` | `number` (px) | 2 | Tolerance for `isAtEdge`. |
| `follow` | `boolean \| (ctx: FollowContext) => boolean` | follow if pinned | See [Follow](#follow). |
| `onRangeChange` | `(range: VisibleRange) => void` | none | Visible range (no overscan) changed. |
| `onAtEdgeChange` | `(atEdge: boolean) => void` | none | `isAtEdge(align)` changed (also fires once after mount). |
| `initialSnapshot` | `Snapshot` | none | Restore a position on mount. Creation only. |
| `maxCachedSizes` | `number` | unlimited | Size-cache limit (least recently measured are evicted). Creation only. |

Callbacks run synchronously inside the engine's loop, after the offset is final for that pass.
They may call `scrollToKey` / `scrollToEdge` and may schedule state updates. They must not call
`plan()` / `commit()`.

## Virtualizer methods

| Method | Returns | Description |
| --- | --- | --- |
| `plan(options?)` | `Plan` | `{ start, end, options }`: inclusive range to render. Empty (`end < start`) before `attach()` or when `count` is 0. Pure. |
| `commit(plan)` | `void` | See the contract. May call `host.render(false)`. |
| `attach(scroller)` | `void` | Connects a `Scroller` (replacing a previous one) and runs the loop. |
| `measureElement(el, key)` | `void` | Row ref. `el === null` unregisters. |
| `destroy()` | `void` | Removes listeners, timers and any deferred transform. |
| `scrollToKey(key, { align?, offset? })` | `boolean` | `false` if the key is unknown. Positions at the estimate now, then locks onto the key (see [Target lock](#target-lock)). `align`: `'start'` (default), `'center'`, `'end'`. `offset` is added to the final scroll offset. |
| `scrollToIndex(index, opts?)` | `boolean` | Same, by index. `false` when out of range. |
| `scrollToEdge(edge = align)` | `void` | Jumps to an edge. At the `align` edge with no `hasMore` there, the list becomes pinned. |
| `isAtEdge(edge = align)` | `boolean` | Within `atEdgeThreshold` of that edge. |
| `getVisibleRange()` | `VisibleRange` | Items intersecting the viewport. Same object until it changes (safe for `useSyncExternalStore`). |
| `subscribe(listener)` | `() => void` | Called after the visible range or the at-edge state changes. Returns unsubscribe. |
| `getItemRect(key)` | `ItemRect \| null` | `{ start, size, measured }` in content space. `measured` is false for estimates and for sizes made stale by a cross-axis resize. |
| `getTotalSize()` | `number` | List size including padding and gaps (estimates included). |
| `indexOf(key)` | `number` | O(1). -1 if unknown. |
| `getSnapshot()` | `Snapshot` | `{ key, index, delta, pinned }`. Serializable. |

Before the first `commit()`, the engine knows no keys: `scrollToKey` returns false and
`indexOf` returns -1.

## Scrollers

```ts
interface Scroller<E> {
  offset(): number; setOffset(offset: number): void
  viewport(): number; crossSize(): number; scrollSize(): number
  overscrolled(): number                       // 0 inside, distance past an edge while rubber-banding
  measure(el: E): { start: number; size: number } // relative to the viewport start
  listStart(): number                          // list element start relative to the viewport start
  setSpacers(before: number, after: number): void
  translate(px: number): void                  // deferred-correction transform on the content wrapper
  setIndex(el: E, index: number, setSize: number): void
  observe(el: E): void; unobserve(el: E): void
  listen(handler: (event: ScrollerEvent) => void): () => void
  now(): number; frame(cb): () => void; timeout(cb, ms): () => void
  readonly touchWebKit: boolean
}
```

- `elementScroller({ element, list, content?, axis? })`: the DOM implementation. `axis` is `VERTICAL`
  (default) or `HORIZONTAL` (left-to-right; RTL is not normalised in v0.1). It listens to `scroll`,
  `touchstart`, `touchend`, `touchcancel`, `scrollend` and `wheel` (passive), and observes the scroll
  container, content wrapper, list and rows with one `ResizeObserver`.
- `simulatedScroller(options?)`: a deterministic, DOM-free layout for tests and benchmarks. It models
  a header, rows with a gap and a footer, and a manual clock (`tick()`, `advance(ms)`). It uses the
  browser's event order: offset clamps queue `scroll`, size changes queue `resize`, and `tick()`
  delivers scroll before resize, then runs frame callbacks.
- `ScrollerEvent`: `'scroll' | 'resize' | 'touchstart' | 'touchend' | 'touchcancel' | 'scrollend'`,
  and anything else (`'input'`, `'wheel'`, …) counts as user input.

## Behaviour

### Modes

- **Edge**: pinned to an edge. Pinned at `align` with no `hasMore` there: the list follows that edge
  through appends (end) or prepends (start), trims and resizes. Any other edge mode (from
  `scrollToEdge`) becomes an item anchor once the frame settles.
- **Item**: the first item reaching into the viewport is anchored by its `align`-side edge (end edge
  for `'end'`, start edge for `'start'`), together with 2 fallbacks after and 2 before it. The anchor is
  re-captured at the end of every settled frame, so all its points come from one measured layout.
  - **Small corrections.** Corrections of 0.25 px or less are not written. The same anchor keeps its
    intended position, so these never add up, and a change moves content by at most 0.5 px.
  - **Clamped positions.** A position that was clamped (unreachable) is adopted.
  If the anchor is removed, the first surviving fallback (after, before, after, before) takes over.
  If all are gone, the item now at the anchor's index takes over. The list never jumps to an edge
  unless it was pinned.
- **Target**: set by `scrollToKey`. See [Target lock](#target-lock).

A user scroll re-captures an item anchor, or pins when it ends within `atEdgeThreshold` of the `align`
edge with no `hasMore` there.

### Follow

When items are added at the `align` edge (appends for `'end'`, prepends for `'start'`), `follow`
decides:

- **Default**: stay pinned if pinned.
- **`true` / function returning true**: jump to the edge and pin (for example the user's own message).
  This has no effect if `hasMore` is set for that edge.
- **`false`** while pinned: stop following and keep the content in place.

A trim at the other end in the same update (trim+append) does not break following. The function
receives `{ atEdge, added, count }` and runs in both `plan()` and `commit()`, so it must be pure.

### Resizes

- **Viewport main-axis resize**: the pinned edge stays fixed. For `'end'`, content keeps its distance
  from the viewport bottom (for example when an on-screen keyboard opens). For `'start'`, it keeps
  its distance from the top.
- **Cross-axis resize** (width for vertical lists): every cached size is marked stale. Mounted rows are
  re-measured in the same `ResizeObserver` callback and the anchor is restored before paint.
- **Row or header/footer resize**: re-measured and compensated in the same callback.
- **Offset clamps**: when content shrinks or the viewport grows, the browser clamps the offset and
  fires `scroll` before the resize callback. Such a scroll is recognised as a clamp, not a user
  scroll, so the anchor is still restored.

### Deferred corrections

Writing the scroll offset during touch momentum on iOS/iPadOS WebKit stops the fling, and writing it
during a desktop Safari rubber-band bounce is janky. A correction is therefore held as a `transform`
on the content wrapper, and the effective offset is `offset + pending`, when:

- `scroller.touchWebKit` is true and a touch is active or the last scroll was less than 120 ms ago; or
- `scroller.overscrolled() !== 0`.

The correction is committed to the scroll offset (and the transform cleared) on `scrollend`, after
120 ms without scroll events, or as soon as overscroll ends. Visual positions are identical before and
after. While overscrolled, `onStartReached` / `onEndReached` are suppressed.

### Target lock

`scrollToKey` jumps to the estimated position at once (no blank frame), then re-aligns the key on
every measurement. It stays locked until 2 consecutive animation frames pass with no resize, or
500 ms pass. It is cancelled by user input (`touchstart`, `wheel`, or any user scroll). It then
becomes an item anchor. An unknown key returns false and changes nothing.

### Edge triggers

`onStartReached` fires when the viewport start is within `startThreshold` of the list start and
`hasMoreStart` is true. It fires once on entering that zone, and again whenever the first item's key
changes while still inside it (a page arrived but the viewport is still near the start). Leaving the
zone re-arms it. `onEndReached` works the same way for the end. Both are suppressed while
overscrolled.

### Snapshots

`getSnapshot()` returns `{ key, index, delta, pinned }`: the anchor key, its index (used if the key is
gone), and the position of its `align`-side edge relative to the viewport start. Passing it as
`initialSnapshot` restores the anchor exactly once its row is measured. `pinned: true` restores to
the `align` edge.

### Idle work

300 ms after the last settled frame, the engine:

- validates every key against `getKey` (O(n)) and rebuilds on a mismatch. Edge diffs only see the
  edges, and the rendered range is validated on every commit.
- refreshes size estimates when the measured average drifts by more than 10%.

At 100k items this takes about 10–28 ms. See DESIGN.md.

## Data structures

These are exported for advanced use and tests.

- `createSizeIndex(): SizeIndex`: a Fenwick tree over a two-ended `Float64Array`. Costs:
  - `prepend` / `append` / `trimStart` / `trimEnd`: O(k log n);
  - `setSize`, `offsetOf`, `findIndexAtOffset`: O(log n);
  - `total`: O(1);
  - `reset`: O(n).

  `setLayout(gap, paddingStart, paddingEnd)` is O(1). `spliceSizes(index, at, remove, insert, sizeAt)`
  uses the edge operations at the edges and rebuilds in O(n) in the middle.
- `createKeyMap(): KeyMap`: key → slot map with `index = slot - base`. `diff(count, getKey)` costs
  O(k) at the edges and O(1) when the edges are unchanged (the shared `NO_CHANGE`). `apply(...)`,
  `validate(from, to, getKey)`.
- `createSizeCache(max?): SizeCache`: sizes by key with deletion, an LRU limit, stale marking and the
  running average.

## Types

```ts
type Key = string | number
type Edge = 'start' | 'end'
type ItemAlign = 'start' | 'center' | 'end'
interface Range { readonly start: number; readonly end: number } // inclusive, empty when end < start
interface Plan extends Range { readonly options: VirtualizerOptions }
interface VisibleRange { startIndex: number; endIndex: number; startKey: Key | null; endKey: Key | null }
interface FollowContext { atEdge: boolean; added: number; count: number }
interface Snapshot { key: Key | null; index: number; delta: number; pinned: boolean }
interface ItemRect { start: number; size: number; measured: boolean }
interface ScrollToOptions { align?: ItemAlign; offset?: number }
```

An empty `VisibleRange` is `{ startIndex: 0, endIndex: -1, startKey: null, endKey: null }`.
