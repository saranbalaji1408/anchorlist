---
'@anchorlist/core': minor
'@anchorlist/react': minor
'anchorlist': minor
---

Any scroller, any axis: window scrolling, horizontal lists and right-to-left.

- `@anchorlist/core/window` adds `windowScroller({ list, content?, axis?, scrollMargin? })` for lists that scroll with the page. `scrollMargin` is the size of fixed UI (an app bar) covering the start of the window; anchoring and `scrollToKey` treat the viewport as starting below it.
- `@anchorlist/core/rtl` adds `rtlScroller({ element, list, content? })` for horizontal lists in a `direction: rtl` container. `scrollLeft` is normalised for all three browser conventions; a left-to-right container gets a plain horizontal scroller.
- Both are subpath entries that reuse `elementScroller`, so the list entry does not grow.
- `@anchorlist/react`: `AnchorList` accepts a `scroller` factory (for example `windowScroller`), also the third argument of `useAnchorList`. `@anchorlist/react/horizontal` adds `horizontal(base?)`, a factory that lays the list out horizontally (`scroller={horizontal()}`, or `horizontal(rtlScroller)` for right-to-left), so the default list stays as small as before.
- `anchorlist` re-exports the new entries as `anchorlist/window`, `anchorlist/rtl` and `anchorlist/horizontal`.
