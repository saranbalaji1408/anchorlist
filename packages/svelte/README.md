# @anchorlist/svelte

Svelte 5 bindings for [`@anchorlist/core`](https://www.npmjs.com/package/@anchorlist/core): a virtual list that keeps the row being read
in place while items are prepended, appended, trimmed, removed or resized. About 2.1 kB gzip on top
of the core (compiled).

Start with the [`anchorlist`](https://www.npmjs.com/package/anchorlist) landing page for an overview.
Full documentation: https://saranbalaji1408.github.io/anchorlist/

```svelte
<script lang="ts">
  import { AnchorList } from '@anchorlist/svelte'
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
  {#snippet children(message)}
    <Bubble {message} />
  {/snippet}
</AnchorList>
```

- **Props:** `items`, `getKey(item)`, `rowClass`, `busy` (sets `aria-busy` on the list), `scroller`
  (read on mount), plus every core option (`align`, `gap`, `overscan`, `follow`, `hasMoreStart`,
  `onEndReached`, `initialSnapshot`, `initialRect`, `initialPlan`, ...). Other attributes (`class`,
  `style`, `id`, `aria-label`, event handlers) go to the scroll container.
- **Snippets:** `children(item)`, `header`, `footer`, and `sticky(list)`, rendered first in the scroll
  container with the virtualizer: put a `StickyOverlay` from `@anchorlist/svelte/sticky` there for an
  overlay pinned to the viewport top that renders from the visible range (a date pill).
- **`bind:this`:** `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`,
  `getVisibleRange`, `getItemRect`, `getTotalSize`, `indexOf`, `subscribe`, and `getElement()` (the
  scroll container, for example for `animateToKey` from `@anchorlist/core/animate`).
- **Focus:** the row containing focus stays mounted (out of flow, at its own position) while it is
  scrolled out of range, so keyboard focus is never lost.
- **Rows get no index**, so a prepend updates no mounted row. A row updates when its item changes or
  when state read in the snippet changes. Keep items immutable (`$state.raw` or new objects).
- **Layouts:** `scroller={horizontal()}` from `@anchorlist/svelte/horizontal` lays the list out on the
  x axis (`horizontal(rtlScroller)` for right-to-left); `scroller={(e) => windowScroller(e)}` from
  `@anchorlist/core/window` scrolls with the page; `LanesList` from `@anchorlist/svelte/lanes` takes
  a `lanes` prop (`grid(...)` or `masonry(...)` from `@anchorlist/core/lanes`).
- **Sticky items:** render `StickyItem` from `@anchorlist/svelte/sticky` in a `StickyOverlay`
  (`range`, `items`, `isSticky`, and a `children(item)` snippet for the stuck copy).
- **Server rendering:** pass `initialRect` and `initialPlan` (from `@anchorlist/core/ssr`); the server
  render and the hydration render produce the same rows.
- **Headless:** `createAnchorList(options, elements, scroller?)` returns `{ virtualizer, plan, kept,
  focused }` for custom markup; render rows `plan.start..plan.end` (and the `kept` row) as the list's
  children, each with `data-key={key}`.
- Requires Svelte 5.18 or later (runes).
