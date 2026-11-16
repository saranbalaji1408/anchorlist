---
'@anchorlist/svelte': minor
---

Add `@anchorlist/svelte`, Svelte 5.18+ (runes) bindings for `@anchorlist/core`.

- `<AnchorList>` takes `items`, `getKey(item)`, `rowClass`, `busy` (`aria-busy` on the list) and `scroller` (read on mount) plus every core option, including `initialRect` and `initialPlan` for server rendering, (`align`, `gap`, `follow`, `hasMoreStart`, `onStartReached`, ...). Other attributes (`class`, `style`, `id`, `aria-label`, event handlers) go to the scroll container. Optional props accept `undefined`.
- Snippets: `children(item)`, `header`, `footer`, and `sticky(range)`, which renders from the visible range.
- Rows get no index, so prepends, trims and appends update no mounted row. A row updates when its item changes or when state read in the snippet changes.
- `bind:this` exposes `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`, the other handle methods and `getElement()`.
- The row containing focus stays mounted, out of flow at its own position, while it is out of range.
- Opt-in entries: `@anchorlist/svelte/sticky` (`StickyItem`), `@anchorlist/svelte/horizontal` (`horizontal()`, also right-to-left with `rtlScroller`) and `@anchorlist/svelte/lanes` (`LanesList` with grid or masonry lanes). Window scrolling uses `windowScroller` through the `scroller` prop.
- `commit()` runs in an effect after the DOM update and before paint. Synchronous re-render requests (from scroll events) use `flushSync`.
- The headless `createAnchorList(options, elements, scroller?)` returns `{ virtualizer, plan, kept, focused }` for custom markup. Rows are registered from the list's children, so they need no ref.
- Packaged with `@sveltejs/package`; the components ship as `.svelte` files with TypeScript stripped and generic typings.
