# @anchorlist/vue

Vue 3 bindings for [`@anchorlist/core`](https://www.npmjs.com/package/@anchorlist/core): a virtual list that keeps the row being read
in place while items are prepended, appended, trimmed, removed or resized. About 1.5 kB gzip on top
of the core.

Start with the [`anchorlist`](https://www.npmjs.com/package/anchorlist) landing page for an overview.
Full documentation: https://saranbalaji1408.github.io/anchorlist/

```vue
<script setup lang="ts">
import { AnchorList } from '@anchorlist/vue'
</script>

<template>
  <!-- align="end" for chat: pinned to the bottom; the default 'start' suits feeds -->
  <AnchorList
    style="height: 600px"
    :items="messages"
    :get-key="(m) => m.id"
    align="end"
    :has-more-start="hasOlder"
    @start-reached="loadOlder"
  >
    <template #default="{ item }">
      <Bubble :message="item" />
    </template>
  </AnchorList>
</template>
```

- **Props:** `items`, `getKey(item)`, `rowClass`, `busy` (`aria-busy`), `scroller`, plus every core
  option (`align`, `gap`, `overscan`, `follow`, `hasMoreStart`, `initialSnapshot`, `initialRect`,
  `initialPlan`, ...). Core callbacks are events: `@start-reached`,
  `@end-reached`, `@range-change`, `@at-edge-change`. `class`, `style` and other attributes go to
  the scroll container.
- **Slots:** `default` (`{ item }`), `header`, `footer`, and `sticky` (receives the visible range).
- **Template ref:** `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`,
  `getVisibleRange`, `getItemRect`, `getTotalSize`, `indexOf`, `subscribe`, and the scroll container
  as `element` (type it with `AnchorListHandle`).
- **Focus preservation:** the row containing focus stays mounted while scrolled out of range.
- **Scrollers** (`scroller`, read on mount): `windowScroller` from `@anchorlist/core/window`,
  `horizontal()` from `@anchorlist/vue/horizontal`, `horizontal(rtlScroller)` for right-to-left.
- **Server rendering:** `initialRect` with `initialPlan` from `@anchorlist/core/ssr`.
- **Opt-in entries:** `StickyItem` (`@anchorlist/vue/sticky`, sticky group headers in the `sticky`
  slot), `horizontal` (`@anchorlist/vue/horizontal`) and `LanesList` (`@anchorlist/vue/lanes`, grid
  and masonry with `@anchorlist/core/lanes`).
- **Rows get no index**, so a prepend re-renders no mounted row. A row re-renders when its item
  changes or when reactive state read in the slot changes. Keep items immutable.
- **Headless:** `useAnchorList(options, elements, scroller?)` returns `[virtualizer, plan]` for custom markup;
  call `plan()` in the render function.
- Requires Vue 3.3 or later.
