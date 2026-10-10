---
'@anchorlist/svelte': minor
---

Add `@anchorlist/svelte`, Svelte 5 (runes) bindings for `@anchorlist/core`.

- `<AnchorList>` takes `items`, `getKey(item)` and `rowClass` plus every core option (`align`, `gap`, `follow`, `hasMoreStart`, `onStartReached`, ...). Other attributes (`class`, `style`, `id`, `aria-label`, event handlers) go to the scroll container. Optional props accept `undefined`.
- Snippets: `children(item)`, `header`, `footer`, and `sticky(range)`, which renders from the visible range.
- Rows get no index, so prepends, trims and appends update no mounted row. A row updates when its item changes or when state read in the snippet changes.
- `bind:this` exposes `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot` and the other handle methods.
- `commit()` runs in an effect after the DOM update and before paint. Synchronous re-render requests (from scroll events) use `flushSync`.
- The headless `createAnchorList(options, elements)` returns `{ virtualizer, plan }` for custom markup. Rows are registered from the list's children, so they need no ref.
- Packaged with `@sveltejs/package`; the components ship as `.svelte` files with TypeScript stripped and generic typings.
