# @anchorlist/core API

Normative reference for `@anchorlist/core` v0.2 and for framework adapters built on it. "Must" and
"must not" are requirements; an adapter that breaks one will show scroll jumps.

- [Model](#model)
- [Adapter contract](#adapter-contract)
- [DOM structure](#dom-structure)
- [Sticky items](#sticky-items)
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
   row components can rely on the container existing. Adapters call
   `options.initialPlan(v, options)` instead when that option is set
   ([server rendering](#server-rendering)); it renders rows before `attach()`.
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
- Rows must never be `position: sticky`: the engine measures rows where they are painted, so a
  stuck row would be measured in the wrong place. Use [sticky items](#sticky-items) instead.

## Sticky items

`@anchorlist/core/sticky` (separate entry, not part of the list entry):

```ts
function stickyState(
  scroller: Element,
  range: VisibleRange,
  isSticky: (index: number) => boolean,
  size: number,
  axis?: Pick<Axis, 'start'>, // default vertical
): { index: number; offset: number }
```

Sticky items (for example group headers) stay in normal flow. The adapter renders an
`aria-hidden`, `inert` copy (so it is neither read nor focusable) of item `index` in the sticky overlay, shifted along the main axis by
`offset`, and calls `stickyState` again on every `scroll` event and after every commit:

- `index` is the last sticky item whose row starts at or before the viewport start (scanning back
  from `range.startIndex`; a row that is not mounted is above the viewport), or -1. The scan is
  remembered per `isSticky` function, so keep one function per item list (a new one when the items
  change) and scrolling costs only the newly passed indices.
- `offset` (≤ 0) is how far the next sticky item pushes the copy out:
  `min(0, nextStart - size)`, where `size` is the copy's size.
- Rows are found through the `data-index` attribute the engine writes, so the copy must not carry
  one. Screen readers read each header once, in its row.

React: `StickyItem` from `@anchorlist/react/sticky`, returned from `AnchorList`'s `sticky` prop.
It shifts the copy with `translateY`: vertical lists only for now.

## createVirtualizer

```ts
function createVirtualizer(options: VirtualizerOptions, host: VirtualizerHost): Virtualizer
interface VirtualizerHost { render(sync: boolean): void }
```

## Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `count` | `number` | required | Item count. |
| `getKey` | `(index) => Key` | required | Unique, stable key (`string \| number`). Must describe the list at the time `plan()` was called, so use immutable snapshots. Duplicate keys are not supported: they disable lazy key validation until the list changes, so the list costs one O(n) rebuild per change. |
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
| `initialRect` | `{ width, height }` | none | Viewport assumed before `attach()`, for server rendering. Read by `initialPlan()`, not by the engine. |
| `initialPlan` | `(v, options) => Plan` | none | Adapters plan with it instead of `plan()`. Pass `initialPlan` from `@anchorlist/core/ssr` for server rendering. Not read by the engine. |
| `maxCachedSizes` | `number` | unlimited | Size-cache limit (least recently measured are evicted; mounted rows never are, even when this is smaller than the mounted count). Creation only. |

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
| `scrollToEdge(edge = align)` | `void` | Jumps to an edge. At the `align` edge with no `hasMore` there, the list becomes pinned; any other edge becomes an item anchor once the frame settles. |
| `isAtEdge(edge = align)` | `boolean` | Within `atEdgeThreshold` of that edge. |
| `getVisibleRange()` | `VisibleRange` | Items intersecting the viewport. Same object until it changes (safe for `useSyncExternalStore`). |
| `subscribe(listener)` | `() => void` | Called after the visible range or the at-edge state changes. Returns unsubscribe. |
| `getItemRect(key)` | `ItemRect \| null` | `{ start, size, measured }` in content space. `measured` is false for estimates and for sizes made stale by a cross-axis resize. |
| `getTotalSize()` | `number` | List size including padding and gaps (estimates included). |
| `indexOf(key)` | `number` | O(1). -1 if unknown. |
| `getSnapshot()` | `Snapshot` | `{ key, index, delta, pinned }`. Serializable. Works before `attach()` and after `destroy()` (model positions). |

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
  (default) or `HORIZONTAL` (left-to-right; use `rtlScroller` for right-to-left). It listens to
  `scroll`, `touchstart`, `touchend`, `touchcancel` and `wheel` (passive), and observes the scroll
  container, content wrapper, list and rows with one `ResizeObserver`.
- `windowScroller({ list, content?, axis?, scrollMargin? })` from `@anchorlist/core/window`: the
  page scrolls instead of a container. The scroll range is the whole document, so page content
  before and after the list acts like a header and footer (`content` should still wrap the list's
  own header and footer). `scrollMargin` (px, default 0) is the size of fixed UI covering the start
  of the window, like CSS `scroll-padding`: the viewport starts after it, so anchoring,
  `scrollToKey` alignment and the visible range ignore what it covers. It listens to `scroll` and
  `resize` on `window` and to input events on the document element. It accepts
  `ElementScrollerOptions` (`element` is ignored), so it can be used wherever an `elementScroller`
  factory is expected. Budget: 0.6 kB gzip on top of the list entry.
- `rtlScroller({ element, list, content? })` from `@anchorlist/core/rtl`: a horizontal scroller for
  a container with `direction: rtl`. The start edge is the right edge, rows run leftwards and the
  normalised offset grows leftwards. `scrollLeft` is normalised for all three browser conventions
  (`negative`, the standard in current browsers; `reverse`; and `default`, with the maximum at the
  start), detected once per call with a throwaway element (`rtlConvention()`). The list's spacers
  are `paddingRight` (before) and `paddingLeft` (after). A left-to-right container gets a plain
  horizontal `elementScroller`. The direction is read when the scroller is created, so re-attach
  after changing it. Budget: 0.6 kB gzip on top of the list entry.

Both subpath scrollers reuse `elementScroller` through a shared chunk, so they add only their own
code to an app that already imports the list entry.
- `simulatedScroller(options?)`: a deterministic, DOM-free layout for tests and benchmarks. It models
  a header, rows with a gap and a footer, and a manual clock (`tick()`, `advance(ms)`). It uses the
  browser's event order: offset clamps queue `scroll`, size changes queue `resize`, and `tick()`
  delivers scroll before resize, then runs frame callbacks. `quantize: 'round' | 'trunc'` stores
  whole-pixel offsets like browsers at DPR 1 (Chromium and Firefox round; WebKit truncates).
- `ScrollerEvent`: `'scroll' | 'resize' | 'touchstart' | 'touchend' | 'touchcancel'`, and anything
  else (`'input'`, `'wheel'`, …) counts as user input (it cancels a `scrollToKey` lock).

## Behaviour

### Modes

- **Edge**: pinned to an edge. Pinned at `align` with no `hasMore` there: the list follows that edge
  through appends (end) or prepends (start), trims and resizes. Any other edge mode (from
  `scrollToEdge`) becomes an item anchor once the frame settles.
- **Item**: the first item reaching into the viewport is anchored by its `align`-side edge (end edge
  for `'end'`, start edge for `'start'`). The anchor is re-captured at the end of every settled frame.
  It records its *intended* position, so whole-pixel rounding never builds up (see
  [Whole pixels](#whole-pixels)). A clamped (unreachable) position is adopted.
- **Removing the anchor.** If the anchor is removed, the rows **after** the gap stay still, for both
  aligns. If nothing after it survives, the rows before it stay still.
- **Clear or replace.** If nothing survives (the list was cleared and refilled, or fully replaced),
  the list starts over at the `align` edge, like a fresh mount.
- **Target**: set by `scrollToKey`. See [Target lock](#target-lock).

### User movement

Any change of the scroll offset that the engine did not make is user movement. It is detected at the
start of every commit and pass as well as on `scroll`, so a re-render that commits after a user scroll
but before its `scroll` event keeps the scroll, and still applies its own compensation (for example a
prepend). Content that shrank under an offset at its end (a browser clamp) is not user movement. A
user scroll re-anchors where the user is, or pins when it ends within `atEdgeThreshold` of the
`align` edge (released again if `hasMore` is set there).

### Whole pixels

Browsers store scroll offsets in whole pixels at DPR 1 (Chromium and Firefox round, WebKit
truncates), while rows have fractional sizes, so most corrections cannot be exact. The engine writes
rounded offsets, reads them back and keeps each anchor's intended position. Guarantees at DPR 1:

- each painted change moves content at most **0.5 px**, or at most 1 px when the error already
  exceeded 0.5 px;
- content is never more than **1 px** from its intended position, so errors do not build up.

With sub-pixel offsets (DPR 2 and above), the steps halve. `scrollToKey` targets and edges are
written exactly.

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

The correction is committed to the scroll offset (and the transform cleared) 120 ms after the last
scroller event, or as soon as overscroll ends. Visual positions are identical before and
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

`getSnapshot()` returns `{ key, index, delta, pinned }`: the anchor key, its index at the time
(informational; -1 for an empty list), and the intended position of its `align`-side edge
relative to the viewport start. Passing it as `initialSnapshot` restores the anchor exactly once its
row is measured. If the key no longer exists, the list starts at the `align` edge. `pinned: true`
restores to the `align` edge.

`@anchorlist/core/snapshot` (separate entry) adds measured sizes, so that the rows around the
anchor are laid out at their real sizes from the first frame (the anchor is restored either way;
this keeps the scroll range and the rows above it exact):

```ts
function takeSnapshot(v, getKey: (index) => Key, count: number, limit = 100): Snapshot // + sizes
function snapshotEstimate(snapshot, getKey: (index) => Key, estimateSize?): ((index) => number) | undefined
```

- `takeSnapshot` stores `sizes: [key, size][]` for the measured items within `limit` indices around
  the anchor. The result is JSON-serializable.
- `snapshotEstimate` returns an `estimateSize` that answers stored sizes, then `estimateSize`, then
  the average stored size. Pass it with `initialSnapshot`. It returns `estimateSize` unchanged when
  there are no stored sizes. Because it sets `estimateSize`, the idle average refresh is off.

### Idle work

300 ms after the last settled frame, the engine:

- validates every key against `getKey` (O(n)) and rebuilds on a mismatch. Edge diffs only see the
  edges, and the rendered range is validated on every commit.
- refreshes size estimates when the measured average drifts by more than 10%. The new estimate is
  rounded to whole pixels, so lists of whole-pixel rows stay on whole pixels.

At 100k items this takes about 5–9 ms. See DESIGN.md.

### Server rendering

Server rendering is opt-in, so lists that do not use it carry none of its code: pass
`initialPlan` from `@anchorlist/core/ssr` (separate entry) as the `initialPlan` option, together
with `initialRect`. Adapters plan with `options.initialPlan(v, options)` when it is set.

`initialPlan(v, options)` returns `v.plan(options)`, except while the plan is empty before
`attach()`: then it returns the rows that fill `initialRect.height` by `estimateSize` (default
48 px), forwards from the `initialSnapshot` item when it is still at its index (same key at
`snapshot.index`, not pinned), else from the `align` edge. It is deterministic, so the server
render and the hydration render produce the same rows. On `attach()` the engine takes over
(writing spacers and the offset, and restoring `initialSnapshot` exactly).

- Without `initialRect`, nothing changes: no rows before `attach()`.
- The server markup has no spacers and no scroll offset, so before hydration the rows sit at the
  top of the scroller: for `align: 'end'` the newest rows are top-aligned until hydration.
- With `initialSnapshot`, the server HTML starts at the snapshot item (top-aligned, without its
  `delta`), so hydration moves the content by at most the snapshot's `delta`.
- It reads `initialRect.height` only: vertical lists.
- Adapters use an isomorphic layout effect (a passive effect where there is no DOM), so server
  rendering never runs layout effects.

### Focus preservation

The row containing focus must never unmount: unmounting blurs it and loses the screen reader
position. `keptRow(v, plan, key)` (main entry) tells an adapter where to keep the row with `key`
while it is outside `plan`:

- `null` when `key` is null, inside the range, unknown or not committed yet;
- else `{ index, start }`: its index in `plan.options` (looked up by key when the list changed
  since the last commit; O(n) only then) and its start in list space (padding included).

The adapter renders it with `position: absolute; top: start; width: 100%` inside the list (the
scroll container is `position: relative`), before the planned rows when `index < plan.start` and after them
otherwise, in the same keyed child list, so the framework never moves its node. It stays registered
with `measureElement`, so it keeps `data-index` / `aria-posinset`. The adapter tracks the focused key
from `focusin` (the row's `data-index`) and clears it on `focusout` unless the window lost focus.

Lists should also set `aria-busy` on the list element while loading (React: `busy`).

The kept row is positioned in content space, so its containing block must be the scroll
container (`position: relative` on it, nothing positioned in between). `top` makes it vertical-only
for now.

### Smooth scrolling

`@anchorlist/core/animate` (separate entry):

```ts
function animateToKey(
  v: Pick<Virtualizer, 'getItemRect' | 'scrollToKey'>,
  element: HTMLElement, // the scroll container
  key: Key,
  options?: ScrollToOptions & { duration?: number; easing?: (t) => number; axis?; signal?: AbortSignal },
): Promise<boolean>
```

- Every animation frame recomputes the target from `getItemRect(key)` (estimated for unmounted
  rows, then measured as rows mount) and covers the eased share of the remaining distance, so a
  target that moves is still met at the end. The last frame calls `scrollToKey(key, options)`, which
  lands exactly and locks while sizes settle. Default: 400 ms, ease in-out cubic.
- Frames write the offset like a user scroll, so the engine keeps the visible rows anchored while
  rows mount on the way.
- `wheel`, `touchstart`, `pointerdown` or `keydown` on the element, `signal`, or a newer animation
  on the same element cancel it (resolves `false`). An unknown key, a key removed on the way, or a
  container detached on the way (the list unmounted) resolve `false`.
- `element` must be the scroll container itself. `axis` selects `scrollLeft` for horizontal lists,
  but RTL offsets are not normalised yet.
- With `prefers-reduced-motion: reduce` or `duration <= 0` it jumps (`scrollToKey`) at once.

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
interface Snapshot { key: Key | null; index: number; delta: number; pinned: boolean; sizes?: [Key, number][] }
interface ItemRect { start: number; size: number; measured: boolean }
interface ScrollToOptions { align?: ItemAlign; offset?: number }
```

An empty `VisibleRange` is `{ startIndex: 0, endIndex: -1, startKey: null, endKey: null }`.
