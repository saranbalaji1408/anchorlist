---
'@anchorlist/vue': minor
---

Add `@anchorlist/vue`, Vue 3.3+ bindings for `@anchorlist/core`.

- `<AnchorList>` takes `items`, `getKey(item)` and `rowClass` plus every core option. Core callbacks are also events (`@start-reached`, `@end-reached`, `@range-change`, `@at-edge-change`). `class`, `style` and other attributes go to the scroll container.
- Slots: `default` (`{ item }`), `header`, `footer`, and `sticky`, which receives the virtualizer; `StickyOverlay` from `@anchorlist/vue/sticky` renders an overlay there from the visible range.
- Rows get no index, so prepends, trims and appends re-render no mounted row. A row re-renders when its item changes or when reactive state read in the slot changes.
- The template ref exposes `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot` and the other handle methods (typed as `AnchorListHandle`).
- `commit()` runs in the mounted and updated hooks, before paint. Synchronous re-render requests (from scroll events) update the component synchronously.
- Parity with the React bindings: the focused row stays mounted outside the rendered range, `busy` sets `aria-busy`, the `scroller` prop takes `windowScroller`, `horizontal()` and `horizontal(rtlScroller)`, `initialRect` with `initialPlan` renders rows on the server and while hydrating, and the template ref exposes the scroll container as `element`.
- Opt-in entries: `@anchorlist/vue/sticky` (`StickyOverlay`, the sticky range overlay, and `StickyItem`, sticky group headers), `@anchorlist/vue/horizontal` (`horizontal(base?)`) and `@anchorlist/vue/lanes` (`LanesList`, grid and masonry with `@anchorlist/core/lanes`).
- The headless `useAnchorList(options, elements, scroller?)` composable returns `[virtualizer, plan]` for custom markup.
- Generic component typing: `item` in the default slot is typed from `items` in templates checked by `vue-tsc`.
- Vue main entry budget 1.4 kB (was 1.3 kB): runtime prop declaration is Vue-only, about 190 B; user decision 2026-11-16. The sticky range overlay moved to `@anchorlist/vue/sticky` (budget 0.95 kB, core included).
- Vue main entry budget 1.45 kB (was 1.4 kB): v0.4 adapter contract (keptRow offset, mapRange), +10 B; user decision 2026-11-16.
