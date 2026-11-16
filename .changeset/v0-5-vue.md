---
'@anchorlist/vue': minor
---

Add `@anchorlist/vue`, Vue 3.3+ bindings for `@anchorlist/core`.

- `<AnchorList>` takes `items`, `getKey(item)` and `rowClass` plus every core option. Core callbacks are also events (`@start-reached`, `@end-reached`, `@range-change`, `@at-edge-change`). `class`, `style` and other attributes go to the scroll container.
- Slots: `default` (`{ item }`), `header`, `footer`, and `sticky`, which renders from the visible range.
- Rows get no index, so prepends, trims and appends re-render no mounted row. A row re-renders when its item changes or when reactive state read in the slot changes.
- The template ref exposes `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot` and the other handle methods (typed as `AnchorListHandle`).
- `commit()` runs in the mounted and updated hooks, before paint. Synchronous re-render requests (from scroll events) update the component synchronously.
- Parity with the React bindings: the focused row stays mounted outside the rendered range, `busy` sets `aria-busy`, the `scroller` prop takes `windowScroller`, `horizontal()` and `horizontal(rtlScroller)`, `initialRect` with `initialPlan` renders rows on the server and while hydrating, and the template ref exposes the scroll container as `element`.
- Opt-in entries: `@anchorlist/vue/sticky` (`StickyItem`, sticky group headers in the `sticky` slot), `@anchorlist/vue/horizontal` (`horizontal(base?)`) and `@anchorlist/vue/lanes` (`LanesList`, grid and masonry with `@anchorlist/core/lanes`).
- The headless `useAnchorList(options, elements, scroller?)` composable returns `[virtualizer, plan]` for custom markup.
- Generic component typing: `item` in the default slot is typed from `items` in templates checked by `vue-tsc`.
