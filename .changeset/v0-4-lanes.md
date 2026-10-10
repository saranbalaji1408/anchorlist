---
'@anchorlist/core': minor
'@anchorlist/react': minor
'anchorlist': minor
---

Lanes: virtual grids and masonry.

- `@anchorlist/core/lanes` adds `grid({ lanes, gap?, horizontal? })` and `masonry({ lanes, gap?, horizontal? })`. Items are positioned absolutely in lanes while the engine stays 1-D: a grid puts each row's size on its first item, and masonry reports each item's share of the main axis. Layout is lazy, in typed arrays, with a running maximum of lane ends. Anchoring, edges, `scrollToKey` and edge triggers work as for plain lists. Budget: 1.5 kB gzip, and the list entry does not grow.
- `@anchorlist/react/lanes` adds `LanesList`: an `AnchorList` laid out by a `lanes` prop. The default `AnchorList` does not grow.
- `anchorlist/lanes` re-exports both lanes entries (`grid`, `masonry`, `LanesList`).
- `pnpm size` now checks that the list import tree-shakes every optional core entry, and `AnchorList` every optional React entry.
