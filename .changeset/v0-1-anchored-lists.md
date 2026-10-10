---
'@anchorlist/core': minor
'@anchorlist/react': minor
'anchorlist': minor
---

First release: virtual lists with stable, key-based scroll anchoring.

- `@anchorlist/core` adds the virtualizer engine. `createVirtualizer(options, host)` renders only the items near the viewport and keeps the scroll position anchored to an item key, restored from DOM measurements before paint.
  - It supports lists pinned to either edge (`align: 'start' | 'end'`).
  - It follows new items at the pinned edge, including trim+append.
  - When the anchor item is removed, fallbacks on both sides take over.
  - `scrollToKey` stays locked on its target while sizes settle.
  - On touch WebKit and during rubber-band overscroll, corrections are held in a transform instead of being written to the scroll offset.
  - It also ships the `elementScroller` and `simulatedScroller` adapters and the `SizeIndex`, `KeyMap` and `SizeCache` data structures.
- `@anchorlist/react` adds `<AnchorList>` and the headless `useAnchorList` hook for React 18 and 19.
  - It takes `items`, `getKey(item)` and `renderItem(item)` plus every core option.
  - Rows get no index, so prepends, trims and appends re-render no mounted row.
  - It supports a header and a footer that move with deferred corrections, and a sticky overlay rendered from the visible range.
  - The imperative handle has `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge` and `getSnapshot`.
  - It works under StrictMode and with concurrent rendering.
- `anchorlist` re-exports `@anchorlist/core` and `@anchorlist/react`. `react` and `react-dom` are required peer dependencies.
