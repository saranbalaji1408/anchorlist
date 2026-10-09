---
'@anchorlist/react': minor
'anchorlist': minor
---

Add the React bindings. `<AnchorList>` renders a virtual list with stable scroll anchoring from `items`, `getKey(item)` and `renderItem(item)`, and accepts every core option (`align`, `gap`, `follow`, `hasMoreStart`, `onEndReached`, ...). Rows are keyed only by key and receive no index, so prepends, trims and appends re-render no mounted row. It supports a header and a footer that move with deferred corrections, a sticky overlay rendered from the visible range, and an imperative handle with `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge` and `getSnapshot`. `useAnchorList` is the headless hook behind it. Both are safe under StrictMode and concurrent rendering. The unscoped `anchorlist` package now re-exports `@anchorlist/core` and `@anchorlist/react`.
