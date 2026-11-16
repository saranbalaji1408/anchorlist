---
title: Vue virtual list with stable scroll anchoring
description: Use anchorlist in Vue 3 with @anchorlist/vue - chat lists, feeds, sticky headers, focus preservation, server rendering, window, horizontal, right-to-left and grid or masonry lists.
---

# Vue

`@anchorlist/vue` binds the core to Vue 3.3 or later. It has the same features as the React
bindings, with Vue conventions: props in kebab case, core callbacks as events, rows as a scoped slot
and the handle through a template ref.

```sh
npm install @anchorlist/vue
```

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
    <template #default="{ item }"><Bubble :message="item" /></template>
  </AnchorList>
</template>
```

- **Props:** `items`, `get-key`, `row-class`, `busy`, `scroller`, plus every core option (`align`, `gap`,
  `overscan`, `follow`, `has-more-start`, `initial-snapshot`, `initial-rect`, `initial-plan`, ...).
- **Events:** `@start-reached`, `@end-reached`, `@range-change`, `@at-edge-change`.
- **Slots:** `default` (`{ item }`), `header`, `footer` and `sticky` (receives the virtualizer; render a
  `StickyOverlay` from `@anchorlist/vue/sticky` there).
- **Attributes** (`class`, `style`, `id`, `aria-label`, `dir`, ...) go to the scroll container.
- **Template ref** (`AnchorListHandle`): `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`,
  `getSnapshot`, `getVisibleRange`, `getItemRect`, `getTotalSize`, `indexOf`, `subscribe`, and the
  scroll container as `element`.
- Rows get no index, so a prepend re-renders no mounted row. Keep items immutable.

## Sticky overlay and sticky headers

`@anchorlist/vue/sticky` holds the sticky overlay, so lists without one stay smaller.
`StickyOverlay` is pinned to the top of the viewport and renders its slot from the visible range,
for example a date pill:

```vue
<template #sticky="list">
  <StickyOverlay :list="list" v-slot="range"><DatePill :at="range.startKey" /></StickyOverlay>
</template>
```

`StickyItem` inside it keeps the last header scrolled past at the top, as an `aria-hidden`, `inert`
copy (see [sticky group headers](/guide/sticky-headers)).

```vue
<script setup lang="ts">
import { AnchorList } from '@anchorlist/vue'
import { StickyItem, StickyOverlay } from '@anchorlist/vue/sticky'
const isHeader = (row: Row) => row.kind === 'header'
</script>

<template>
  <AnchorList style="height: 600px" :items="rows" :get-key="(r) => r.id">
    <template #default="{ item }"><RowView :row="item" /></template>
    <template #sticky="list">
      <StickyOverlay :list="list" v-slot="range">
        <StickyItem :range="range" :items="rows" :is-sticky="isHeader" v-slot="{ item }">
          <RowView :row="item" />
        </StickyItem>
      </StickyOverlay>
    </template>
  </AnchorList>
</template>
```

## Accessibility and focus

The row containing focus stays mounted while it is scrolled out of the rendered range, so keyboard
and screen reader users keep their place. Set `busy` while a page loads to mark the list
`aria-busy` (see [accessibility and focus](/guide/accessibility)).

## Smooth scrolling

```ts
import { animateToKey } from '@anchorlist/core/animate'
const list = ref<AnchorListHandle>()
animateToKey(list.value!, list.value!.element, 'm42')
```

## Server rendering

Pass `initial-rect` and `initial-plan` (from `@anchorlist/core/ssr`). The server HTML and the
hydration render then contain the rows that fill the rectangle, so there is no hydration mismatch.
See [server rendering](/guide/server-rendering).

```vue
<script setup lang="ts">
import { initialPlan } from '@anchorlist/core/ssr'
</script>

<template>
  <AnchorList :items="items" :get-key="(m) => m.id" :initial-rect="{ width: 400, height: 600 }" :initial-plan="initialPlan" style="height: 600px">
    <template #default="{ item }"><Row :item="item" /></template>
  </AnchorList>
</template>
```

## Window, horizontal and right-to-left

The `scroller` prop is read on mount. The default scrolls the container vertically.

```vue
<script setup lang="ts">
import { windowScroller } from '@anchorlist/core/window'
import { rtlScroller } from '@anchorlist/core/rtl'
import { horizontal } from '@anchorlist/vue/horizontal'
const pageScroller = (e) => windowScroller({ ...e, scrollMargin: 56 })
</script>

<template>
  <!-- Scrolls with the page, under a 56 px fixed app bar -->
  <AnchorList :items="items" :get-key="(m) => m.id" :scroller="pageScroller">...</AnchorList>
  <!-- Rows run left to right; give the container a width and a height -->
  <AnchorList :items="items" :get-key="(m) => m.id" :scroller="horizontal()" style="width: 800px; height: 200px">...</AnchorList>
  <!-- Right to left -->
  <AnchorList :items="items" :get-key="(m) => m.id" :scroller="horizontal(rtlScroller)" dir="rtl" style="width: 800px; height: 200px">...</AnchorList>
</template>
```

See [window scroller](/guide/window-scroller), [horizontal list](/guide/horizontal-list) and
[right-to-left](/guide/rtl-virtual-list).

## Grid and masonry

`LanesList` from `@anchorlist/vue/lanes` takes every `AnchorList` prop and slot plus `lanes`, a
layout from `@anchorlist/core/lanes`. The lanes own the gap. Create the layout once per list. See
[virtual grid and masonry](/guide/virtual-grid-masonry) for the options and limits; as with React,
lanes under `windowScroller` or `horizontal()` are expected to work but are not yet covered by
tests.

```vue
<script setup lang="ts">
import { masonry } from '@anchorlist/core/lanes'
import { LanesList } from '@anchorlist/vue/lanes'
const lanes = masonry({ lanes: 3, gap: 8 })
</script>

<template>
  <LanesList style="height: 600px" :items="photos" :get-key="(p) => p.id" :lanes="lanes">
    <template #default="{ item }"><Photo :photo="item" /></template>
  </LanesList>
</template>
```

## Headless

`useAnchorList(options, elements, scroller?)` returns `[virtualizer, plan]` for custom markup. Call
it in `setup()` and call `plan()` in the render function only.

## Size

Sizes are min + gzip, checked in CI. `@anchorlist/vue` is 1,410 B with Vue and the core external
(budget 1.45 kB), and the Vue chat path (core + `AnchorList`) is 5,704 B (budget 5.8 kB). The opt-in
entries are separate: `/sticky` 905 B (950 B), `/horizontal` 189 B (300 B) and `/lanes` 381 B
(450 B). A CI check confirms that `AnchorList` pulls in none of them.

## How it is tested

The Vue fixture runs the same end-to-end scenarios as React in Chromium, WebKit and Firefox:
anchoring through prepends, trims and resizes, chat pinning, `scrollToKey`, sticky items, focus
preservation, `aria-busy`, smooth scrolling, server rendering and hydration, window, horizontal and
right-to-left lists, and grid and masonry lanes. The React transitions scenario is skipped on Vue
(it has no Vue equivalent), and the performance scenario checks timings but not the heap, because
the scenarios run a Vue development build, which holds memory until a later collection. Unit tests run against Vue 3.3,
the supported minimum, and the current Vue.

## Related

- [Getting started](./getting-started) (React)
- [Virtual grid and masonry](./virtual-grid-masonry)
- [API reference: Vue](/api/#vue)
