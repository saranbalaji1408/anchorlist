---
'@anchorlist/core': minor
'@anchorlist/react': minor
'anchorlist': minor
---

Production features. The core list entry (`createVirtualizer` + `elementScroller`) is unchanged in size; new features are adapter helpers or opt-in entries.

- Sticky items: `stickyState` in `@anchorlist/core/sticky` and `StickyItem` in `@anchorlist/react/sticky`. The last sticky item scrolled past is shown as an `aria-hidden` copy at the viewport start and pushed out by the next one; rows stay in normal flow.
- Focus preservation: the row containing focus stays mounted outside the rendered range, out of flow at its own position (`keptRow` in the core for adapters). `AnchorList` gains `busy` for `aria-busy`.
- Smooth scrolling: `animateToKey` in `@anchorlist/core/animate` reaches rows that are not mounted by recomputing the target every frame, lands through `scrollToKey`, respects `prefers-reduced-motion` and is cancelled by user input. The React handle exposes the scroll container as `element`.
- Server rendering: the `initialRect` option and `initialPlan` render the rows that fill it on the server and during hydration, without a mismatch.
- Scroll restoration with sizes: `takeSnapshot` and `snapshotEstimate` in `@anchorlist/core/snapshot`.
- `anchorlist` re-exports the new entries as `anchorlist/sticky`, `anchorlist/animate` and `anchorlist/snapshot`.
