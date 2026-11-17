---
title: anchorlist API reference (React and core)
description: API reference for anchorlist, @anchorlist/react and @anchorlist/core. Covers the AnchorList component, createVirtualizer options and methods, scrollers, follow, edge triggers, snapshots and the adapter contract.
---

# API reference

| Package | Contents |
| --- | --- |
| `anchorlist` | Re-exports everything below. |
| `@anchorlist/react` | React 18 / 19 component. |
| `@anchorlist/core` | Framework-agnostic engine, zero dependencies: `createVirtualizer`, `elementScroller`, `simulatedScroller`, data structures, types. |

All packages are ESM only, ship TypeScript declarations and target ES2020.

## React

```tsx
import { AnchorList, type AnchorListHandle } from 'anchorlist'
// or: import { AnchorList } from '@anchorlist/react'
```

### `<AnchorList>` props

| Prop | Type | Notes |
| --- | --- | --- |
| `items` | `readonly T[]` | The items, as an immutable snapshot. Pass a new array instead of mutating it. |
| `getKey` | `(item: T) => Key` | Unique, stable key per item. The scroll position is anchored to keys. |
| `renderItem` | `(item: T) => ReactNode` | Renders one item. It receives no index, so a prepend re-renders no mounted rows. Keep it stable (module scope or `useCallback`) to skip re-renders. |
| `header` / `footer` | `ReactNode` | Rendered above / below the rows, inside the scroll content. They may change size at any time. |
| `sticky` | `(range: VisibleRange) => ReactNode` | Overlay pinned to the top of the viewport (for example a date pill). Re-renders only when the visible range changes. |
| `className` / `style` | `string` / `CSSProperties` | Applied to the scroll container. Give it a height, and no main-axis border. |
| `rowClassName` | `string` | Class of each row wrapper. Don't give rows margins; use `gap`. |
| `scrollerProps` | `HTMLAttributes<HTMLDivElement>` | Extra attributes for the scroll container (`id`, `aria-label`, `onKeyDown`, ...). |
| `ref` | `Ref<AnchorListHandle>` | Imperative handle, see below. |
| ...core options | | Every [core option](#options) except `count` and `getKey` is passed through unchanged: `align`, `overscan`, `gap`, `paddingStart`, `paddingEnd`, `estimateSize`, `hasMoreStart`, `hasMoreEnd`, `startThreshold`, `endThreshold`, `onStartReached`, `onEndReached`, `atEdgeThreshold`, `follow`, `onRangeChange`, `onAtEdgeChange`, `initialSnapshot`, `maxCachedSizes`. |

`align`, `initialSnapshot` and `maxCachedSizes` are read once, on mount.

### `AnchorListHandle`

`scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`, `getVisibleRange`,
`getItemRect`, `getTotalSize`, `indexOf`, `subscribe`. They behave as the
[virtualizer methods](#virtualizer-methods) of the same name.

### `useAnchorList(options, elements)`

A lower-level hook for custom markup. It returns `[virtualizer, plan]`. Render rows
`plan.start..plan.end` inside your list element, keyed by `options.getKey(i)`, with a ref that
calls `virtualizer.measureElement(el, key)`. `elements()` returns `{ element, list, content? }`
once they are mounted. Most apps should use `<AnchorList>`.

## Core

```ts
import { createVirtualizer, elementScroller } from '@anchorlist/core'

function createVirtualizer(options: VirtualizerOptions, host: VirtualizerHost): Virtualizer
interface VirtualizerHost { render(sync: boolean): void }
```

The engine works on one axis. It owns every write to the scroll offset and anchors the viewport to
an item **key**. A frame goes like this:

1. The host renders `plan(options)`, a contiguous inclusive index range.
2. After the DOM update and before paint, the host calls `commit(plan)`. The engine diffs keys,
   measures rows, writes spacers, `data-index` / `aria-*` attributes and the scroll offset.
3. If the range must change, it calls `host.render(...)` and the next commit continues, still
   before paint. A frame settles after at most 8 passes.

### Options

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
| `maxCachedSizes` | `number` | unlimited | Size-cache limit (least recently measured are evicted; mounted rows never are, even when this is smaller than the mounted count). Creation only. |

Callbacks run synchronously inside the engine's loop, after the offset is final for that pass. They
may call `scrollToKey` / `scrollToEdge` and may schedule state updates. They must not call `plan()` /
`commit()`.

### Virtualizer methods

| Method | Returns | Description |
| --- | --- | --- |
| `plan(options?)` | `Plan` | `{ start, end, options }`, the inclusive range to render. Empty (`end < start`) before `attach()` or when `count` is 0. Pure. |
| `commit(plan)` | `void` | Applies a rendered plan. See the [adapter contract](#adapter-contract). |
| `attach(scroller)` | `void` | Connects a `Scroller` (replacing a previous one) and runs the loop. |
| `measureElement(el, key)` | `void` | Row ref. `el === null` unregisters. |
| `destroy()` | `void` | Removes listeners, timers and any deferred transform. |
| `scrollToKey(key, { align?, offset? })` | `boolean` | `false` if the key is unknown. Positions at the estimate now, then locks onto the key (see [Target lock](#target-lock)). `align`: `'start'` (default), `'center'`, `'end'`. |
| `scrollToIndex(index, opts?)` | `boolean` | Same, by index. `false` when out of range. |
| `scrollToEdge(edge = align)` | `void` | Jumps to an edge. At the `align` edge with no `hasMore` there, the list becomes pinned; any other edge becomes an item anchor once the frame settles. |
| `isAtEdge(edge = align)` | `boolean` | Within `atEdgeThreshold` of that edge. |
| `getVisibleRange()` | `VisibleRange` | Items intersecting the viewport. Same object until it changes (safe for `useSyncExternalStore`). |
| `subscribe(listener)` | `() => void` | Called after the visible range or the at-edge state changes. Returns unsubscribe. |
| `getItemRect(key)` | `ItemRect \| null` | `{ start, size, measured }` in content space. |
| `getTotalSize()` | `number` | List size including padding and gaps (estimates included). |
| `indexOf(key)` | `number` | O(1). -1 if unknown. |
| `getSnapshot()` | `Snapshot` | `{ key, index, delta, pinned }`. Serializable. Works before `attach()` and after `destroy()`. |

Before the first `commit()` the engine knows no keys: `scrollToKey` returns false and `indexOf`
returns -1.

### Scrollers

- `elementScroller({ element, list, content?, axis? })` is the DOM implementation. `axis` is
  `VERTICAL` (default) or `HORIZONTAL` (left-to-right; RTL is not normalised in v0.1). It listens
  to `scroll`, `touchstart`, `touchend`, `touchcancel` and `wheel` (passive), and
  observes the container, content wrapper, list and rows with one `ResizeObserver`.
- `simulatedScroller(options?)` is a deterministic, DOM-free layout for tests and benchmarks, with
  a manual clock (`tick()`, `advance(ms)`). `quantize: 'round' | 'trunc'` stores whole-pixel
  offsets like browsers at DPR 1.

### Behaviour

#### Follow

When items are added at the `align` edge (appends for `'end'`, prepends for `'start'`):

- **Default:** stay pinned if pinned.
- **`true` / a function returning true:** jump to the edge and pin. This has no effect if
  `hasMore` is set for that edge.
- **`false`** while pinned: stop following and keep the content in place.

A trim at the other end in the same update does not break following. The function receives
`{ atEdge, added, count }`, runs in both `plan()` and `commit()`, and must be pure.

#### Anchoring

When not pinned, the first item reaching into the viewport is anchored by its `align`-side edge
(the end edge for `'end'`, the start edge for `'start'`). The anchor is re-captured at the end of
every settled frame and records its *intended* position. A clamped (unreachable) position is
adopted.

- **Removing the anchor:** the rows **after** the gap stay still, for both aligns. If nothing after
  it survives, the rows before it stay still.
- **Clear or replace:** if no item survives (the list was cleared and refilled, or fully replaced),
  the list starts over at the `align` edge, like a fresh mount.

#### User movement

Any change of the scroll offset that the engine did not make is user movement. It is detected at
the start of every commit as well as on `scroll`, so a re-render that lands after a user scroll but
before its `scroll` event keeps the scroll and still applies its own compensation (for example a
prepend). A browser clamp (content shrinking under an offset at its end) is not user movement. A
user scroll re-anchors where the user is, or pins when it ends within `atEdgeThreshold` of the
`align` edge.

#### Whole pixels

Browsers store scroll offsets in whole pixels at DPR 1, so most corrections can't be exact.
At DPR 1, each painted change moves content by at most 0.5 px (at most 1 px only when the error was
already above 0.5 px), and content is never more than 1 px from its intended position. Errors don't
build up. This holds both on engines that round offsets (Chromium, Firefox) and on engines that
truncate them (WebKit). With sub-pixel offsets (DPR 2 and above) the steps halve.

#### Resizes

- **Viewport main-axis resize:** the pinned edge stays fixed. With `'end'`, content keeps its
  distance from the viewport bottom (for example when an on-screen keyboard opens).
- **Cross-axis resize** (width, for vertical lists): every cached size is marked stale, mounted
  rows are re-measured in the same callback and the anchor is restored before paint.
- **Row or header/footer resize:** re-measured and compensated in the same callback.

#### Deferred corrections

On iOS/iPadOS WebKit during touch momentum, and while rubber-banding, a correction is held as a
`transform` on the content wrapper. It is committed 120 ms after the last scroller event
events, or when overscroll ends. Edge triggers are suppressed while overscrolled.

#### Target lock

`scrollToKey` jumps to the estimated position at once, then re-aligns the key on every
measurement. The lock holds until 2 animation frames pass with no resize, or 500 ms pass. User
input (`touchstart`, `wheel`, any user scroll) cancels it.

#### Edge triggers

`onStartReached` fires when the viewport start is within `startThreshold` of the list start and
`hasMoreStart` is true. It fires once on entering that zone, and again whenever the first item's
key changes while still inside it. Leaving the zone re-arms it. `onEndReached` mirrors this at the
end.

#### Snapshots

`getSnapshot()` returns `{ key, index, delta, pinned }`: the anchor key, its index at the time
(informational; -1 for an empty list) and the intended position of its `align`-side edge. Passing
it as `initialSnapshot` restores the anchor once its row is measured. If the key no longer exists,
the list starts at the `align` edge. `pinned: true` restores to the `align` edge. `getSnapshot()`
also works before `attach()` and after `destroy()`.

#### Idle work

300 ms after the last settled frame, the engine validates every key against `getKey` (O(n)) and
refreshes size estimates. At 100k items this takes about 5–9 ms on an Apple M2.

### Adapter contract

For writing bindings for another framework:

```ts
const v = createVirtualizer(options, { render: (sync) => (sync ? flushSync(rerender) : rerender()) })

// Render phase (pure, may run several times or be discarded):
const plan = v.plan(options)
// Render rows plan.start..plan.end (inclusive), keyed by options.getKey(i).

// After the DOM update and before paint (React: useLayoutEffect):
if (!attached) v.attach(elementScroller({ element, list, content }))
v.commit(plan)

// Row ref callback (stable per key):
ref = (el) => v.measureElement(el, key)

// Unmount:
v.destroy()
```

1. **Create once** per list instance.
2. **Plan in render.** `plan()` never mutates the engine.
3. **Commit before paint,** synchronously, with the same plan object (React `useLayoutEffect`,
   Vue `flush: 'post'`, Svelte 5 `$effect` + `flushSync`). Not from `requestAnimationFrame` or a
   timer.
4. **Attach before the first positioning commit.**
5. **`host.render(sync)`**: with `sync: true` the host must render and commit before returning
   (React `flushSync`). With `sync: false` a normal state update is enough.
6. **Keyed rows, no index props.** The engine writes `data-index`, `aria-posinset` and
   `aria-setsize`.
7. **A ref per row:** `measureElement(el, key)` on mount, `measureElement(null, key)` on unmount.
8. **Never write the scroll offset** and never style the list's main-axis padding.
9. **Destroy on unmount.**

### DOM structure

```html
<div data-scroller style="overflow-y: auto; overflow-anchor: none">
  <div data-content>                       <!-- optional content wrapper -->
    <header>…</header>
    <div data-list style="display: flex; flex-direction: column; gap: {gap}px">
      <div data-index="12" aria-posinset="13" aria-setsize="400">…</div>
      …
    </div>
    <footer>…</footer>
  </div>
</div>
```

- The list's direct children must be exactly the planned rows, in index order. The engine writes
  the spacers as the list's main-axis padding.
- `overflow-anchor: none` on the scroller is required.
- A row's size is its border box: put margins inside the row or use `gap`.
- No main-axis borders on the scroll container or the list.
- The content wrapper receives deferred corrections as a `transform`. Don't put your own transform
  on it.

### Data structures

Exported for advanced use and tests:

- `createSizeIndex()`: a Fenwick tree over a two-ended `Float64Array`. Edge operations cost
  O(k log n); `setSize`, `offsetOf` and `findIndexAtOffset` cost O(log n); `total` is O(1).
- `createKeyMap()`: key-to-slot map with O(k) edge diffs and an O(1) unchanged path.
- `createSizeCache(max?)`: sizes by key with an LRU limit, stale marking and a running average.

### Types

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

The full normative contract lives in
[`packages/core/API.md`](https://github.com/saranbalaji1408/anchorlist/blob/main/packages/core/API.md).
The internals are described in
[`packages/core/DESIGN.md`](https://github.com/saranbalaji1408/anchorlist/blob/main/packages/core/DESIGN.md).
