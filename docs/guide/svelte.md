---
title: Svelte virtual list with stable scroll anchoring (Svelte 5)
description: Use anchorlist in Svelte 5 with @anchorlist/svelte - chat lists and reverse infinite scroll without scroll jump, feeds, sticky headers, focus preservation, server rendering, window, horizontal, right-to-left and grid or masonry lists.
---

# Svelte

`@anchorlist/svelte` binds the core to Svelte 5.18 or later (runes). It has the same features as
the React and Vue bindings, with Svelte conventions: rows as a `children` snippet, core callbacks as
props and the handle through `bind:this`.

```sh
npm install @anchorlist/svelte
```

```svelte
<script lang="ts">
  import { AnchorList } from '@anchorlist/svelte'
  let { messages, hasOlder, loadOlder } = $props()
</script>

<!-- align="end" for chat: pinned to the bottom; the default 'start' suits feeds -->
<AnchorList
  style="height: 600px"
  items={messages}
  getKey={(m) => m.id}
  align="end"
  hasMoreStart={hasOlder}
  onStartReached={loadOlder}
>
  {#snippet children(message)}<Bubble {message} />{/snippet}
</AnchorList>
```

- **Props:** `items`, `getKey`, `rowClass`, `busy`, `scroller`, plus every core option (`align`,
  `gap`, `overscan`, `follow`, `hasMoreStart`, `onStartReached`, `initialSnapshot`, `initialRect`,
  `initialPlan`, ...). `align`, `initialSnapshot`, `maxCachedSizes` and `scroller` are read on mount.
- **Snippets:** `children(item)`, `header`, `footer` and `sticky(list)` (receives the virtualizer;
  render a `StickyOverlay` from `@anchorlist/svelte/sticky` there).
- **Attributes** (`class`, `style`, `id`, `aria-label`, `dir`, event handlers) go to the scroll
  container.
- **`bind:this`:** `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`,
  `getVisibleRange`, `getItemRect`, `getTotalSize`, `indexOf`, `subscribe`, and `getElement()`.
- Rows get no index, so a prepend updates no mounted row. Keep items immutable (`$state.raw`, or new
  objects instead of mutating them).

**One difference from React and Vue:** the scroll container is returned by `getElement()`, a
method, because Svelte component exports can't be live getters. React and Vue expose it as an
`element` property.

## Sticky overlay and sticky headers

`@anchorlist/svelte/sticky` holds the sticky overlay, so lists without one stay smaller.
`StickyOverlay` is pinned to the top of the viewport and renders its `children` snippet from the
visible range. `StickyItem` inside it keeps the last header scrolled past at the top, as an
`aria-hidden`, `inert` copy (see [sticky group headers](/guide/sticky-headers)).

```svelte
<script lang="ts">
  import { AnchorList } from '@anchorlist/svelte'
  import { StickyItem, StickyOverlay } from '@anchorlist/svelte/sticky'
  // Module scope or stable: the walk back to the last header is cached per function.
  const isHeader = (row) => row.kind === 'header'
  let { rows } = $props()
</script>

<AnchorList style="height: 600px" items={rows} getKey={(r) => r.id}>
  {#snippet children(row)}<RowView {row} />{/snippet}
  {#snippet sticky(list)}
    <StickyOverlay {list}>
      {#snippet children(range)}
        <StickyItem {range} items={rows} isSticky={isHeader}>
          {#snippet children(row)}<RowView {row} />{/snippet}
        </StickyItem>
      {/snippet}
    </StickyOverlay>
  {/snippet}
</AnchorList>
```

## Accessibility and focus

The row containing focus stays mounted while it is scrolled out of the rendered range, so keyboard
and screen reader users keep their place. Set `busy` while a page loads to mark the list
`aria-busy` (see [accessibility and focus](/guide/accessibility)).

## Smooth scrolling

```ts
import { animateToKey } from '@anchorlist/core/animate'

let list // bind:this={list}
animateToKey(list, list.getElement(), 'm42')
```

## Server rendering

Pass `initialRect` and `initialPlan` (from `@anchorlist/core/ssr`). The server HTML and the
hydration render then contain the rows that fill the rectangle, so there is no hydration mismatch.
See [server rendering](/guide/server-rendering).

```svelte
<script lang="ts">
  import { initialPlan } from '@anchorlist/core/ssr'
</script>

<AnchorList {items} getKey={(m) => m.id} initialRect={{ width: 400, height: 600 }} {initialPlan} style="height: 600px">
  {#snippet children(item)}<Row {item} />{/snippet}
</AnchorList>
```

## Window, horizontal and right-to-left

The `scroller` prop is read on mount. The default scrolls the container vertically.

```svelte
<script lang="ts">
  import { windowScroller } from '@anchorlist/core/window'
  import { rtlScroller } from '@anchorlist/core/rtl'
  import { horizontal } from '@anchorlist/svelte/horizontal'
  const pageScroller = (e) => windowScroller({ ...e, scrollMargin: 56 })
  const sideways = horizontal()
  const sidewaysRtl = horizontal(rtlScroller)
</script>

<!-- Scrolls with the page, under a 56 px fixed app bar -->
<AnchorList {items} getKey={(m) => m.id} scroller={pageScroller}>...</AnchorList>
<!-- Rows run left to right; give the container a width and a height -->
<AnchorList {items} getKey={(m) => m.id} scroller={sideways} style="width: 800px; height: 200px">...</AnchorList>
<!-- Right to left -->
<AnchorList {items} getKey={(m) => m.id} scroller={sidewaysRtl} dir="rtl" style="width: 800px; height: 200px">...</AnchorList>
```

See [window scroller](/guide/window-scroller), [horizontal list](/guide/horizontal-list) and
[right-to-left](/guide/rtl-virtual-list).

## Grid and masonry

`LanesList` from `@anchorlist/svelte/lanes` takes every `AnchorList` prop and snippet plus `lanes`,
a layout from `@anchorlist/core/lanes`. The lanes own the gap, and a grid always renders whole rows.
Create the layout once per list. See [virtual grid and masonry](/guide/virtual-grid-masonry) for the
options and limits; as with React and Vue, lanes under `windowScroller` or `horizontal()` are
expected to work but are not yet covered by tests.

```svelte
<script lang="ts">
  import { masonry } from '@anchorlist/core/lanes'
  import { LanesList } from '@anchorlist/svelte/lanes'
  const lanes = masonry({ lanes: 3, gap: 8 })
  let { photos } = $props()
</script>

<LanesList style="height: 600px" items={photos} getKey={(p) => p.id} {lanes}>
  {#snippet children(photo)}<Photo {photo} />{/snippet}
</LanesList>
```

Changing the `$state` `items` array in place (a swap, or replacing an item) re-lays out the lanes
at once, also when the change is outside the rendered range. The keys are read once per data
change, not on scroll. For lists of several thousand items that change often (feeds, chat), declare
`items` with `$state.raw` and assign a new array: a deep `$state` array costs a proxy read per item
on every change.

## Headless

`createAnchorList(options, elements, scroller?)` returns `{ virtualizer, plan, rows, kept, focused }`
for custom markup. Call it during component initialisation. Render rows `rows.start..rows.end` and
the `kept` row as the list's only children, keyed by `getKey`, each with `data-key={key}`; set
`focused` when focus enters a row and clear it when focus leaves the list.

## Size

Sizes are min + gzip of the compiled output, checked in CI. `@anchorlist/svelte` is 2,042 B with
Svelte and the core external (budget 2.1 kB), and the Svelte chat path (core + `AnchorList`) is
6,271 B (budget 6.3 kB). The opt-in entries are separate: `/sticky` 737 B (750 B), `/horizontal`
301 B (350 B) and `/lanes` 659 B (750 B). A CI check confirms that `AnchorList` pulls in none of
them.

## How it is tested

The Svelte fixture runs the same end-to-end scenarios as React and Vue in Chromium, WebKit and
Firefox: anchoring through prepends, trims and resizes, chat pinning, `scrollToKey`, sticky items,
focus preservation, `aria-busy`, smooth scrolling, server rendering (through a server build of the
fixture) and hydration, window, horizontal and right-to-left lists, grid and masonry lanes, and the
performance and heap budgets. The React transitions scenario is skipped on Svelte (it has no
Svelte equivalent). Unit tests run against Svelte 5.18, the supported minimum, and the current
Svelte 5.

## Related

- [Getting started](./getting-started) (React)
- [Vue](./vue)
- [Virtual grid and masonry](./virtual-grid-masonry)
- [API reference: Svelte](/api/#svelte)
