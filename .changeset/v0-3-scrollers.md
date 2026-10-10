---
'@anchorlist/core': minor
'@anchorlist/react': minor
'anchorlist': minor
---

Any scroller, any axis: window scrolling, horizontal lists and right-to-left.

- `@anchorlist/core/window` adds `windowScroller({ list, content?, axis?, scrollMargin? })` for lists that scroll with the page. `scrollMargin` is the size of fixed UI (an app bar) covering the start of the window; anchoring and `scrollToKey` treat the viewport as starting below it.
- `@anchorlist/core/rtl` adds `rtlScroller({ element, list, content? })` for horizontal lists in a `direction: rtl` container. `scrollLeft` is normalised for all three browser conventions; a left-to-right container gets a plain horizontal scroller.
- Both are subpath entries that reuse `elementScroller`, so the list entry does not grow.
- `@anchorlist/react`: `AnchorList` accepts `horizontal` (row layout, `overflowX`, widths as sizes) and a `scroller` factory (for example `windowScroller` or `rtlScroller`); `useAnchorList` takes the factory as a third argument.
- `anchorlist` re-exports the new entries as `anchorlist/window` and `anchorlist/rtl`.
