# @anchorlist/react

React 18 / 19 bindings for [`@anchorlist/core`](https://www.npmjs.com/package/@anchorlist/core): a virtual list that keeps the row being read
in place while items are prepended, appended, trimmed, removed or resized. About 1 kB gzip on top of
the core.

Most apps should install the [`anchorlist`](https://www.npmjs.com/package/anchorlist) package, which
re-exports this one and the core. Full documentation: https://saranbalaji1408.github.io/anchorlist/

```tsx
import { AnchorList } from '@anchorlist/react'

const renderMessage = (m: Message) => <Bubble message={m} />

<AnchorList
  style={{ height: 600 }}
  items={messages}
  getKey={(m) => m.id}
  align="end" // chat: pinned to the bottom; the default 'start' suits feeds
  hasMoreStart={hasOlder}
  onStartReached={loadOlder}
  renderItem={renderMessage}
/>
```

- **Props:** `items`, `getKey(item)`, `renderItem(item)`, `header`, `footer`, `sticky(range)`,
  `className`, `style`, `rowClassName`, `scrollerProps`, `busy` (`aria-busy`), `scroller`, plus every core
  option (`align`, `gap`, `overscan`, `follow`, `hasMoreStart`, `onEndReached`, `initialSnapshot`,
  `initialRect`, `initialPlan`, ...).
- **Ref:** `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`,
  `getVisibleRange`, `getItemRect`, `getTotalSize`, `indexOf`, `subscribe`, and the scroll
  container as `element`.
- **Focus:** the row containing focus stays mounted while scrolled out of view.
- **Server rendering:** pass `initialRect` and `initialPlan` (from `@anchorlist/core/ssr`); the
  server and hydration renders then include the rows that fill it, from `initialSnapshot` if set.
- **Sticky items** (group headers): `StickyItem` from `@anchorlist/react/sticky`, returned from
  `sticky`:
  `sticky={(range) => <StickyItem range={range} items={rows} isSticky={isHeader} renderItem={renderRow} />}`.
- **Smooth scrolling:** `animateToKey(ref.current, ref.current.element, key)` from
  `@anchorlist/core/animate`.
- **Restoring with sizes:** `takeSnapshot` / `snapshotEstimate` from `@anchorlist/core/snapshot`.
- **Window, horizontal and right-to-left lists:** pass a `scroller` factory, created once at module
  scope. `scroller={windowScroller}` (`@anchorlist/core/window`) scrolls with the page, with
  `scrollMargin` for a fixed app bar; `scroller={horizontal()}` (`@anchorlist/react/horizontal`)
  lays the list out horizontally; `scroller={horizontal(rtlScroller)}` (`@anchorlist/core/rtl`)
  also handles `dir="rtl"`. With a custom scroller the container gets no `overflow` style.
- **Grid and masonry:** `LanesList` from `@anchorlist/react/lanes` takes every `AnchorList` prop
  plus `lanes`, a `grid({ lanes })` or `masonry({ lanes, gap })` layout from `@anchorlist/core/lanes`
  created once per list (`useState`). Keep `overscan` at least as large as the largest item.
- **Rows get no index**, so a prepend re-renders no mounted row. Keep `renderItem` stable (module
  scope or `useCallback`) and keep item objects immutable to get that benefit.
- **Headless:** `useAnchorList(options, elements, scroller?)` returns `[virtualizer, plan]` for custom markup.
- StrictMode and concurrent rendering (`startTransition`) are supported.
- **Troubleshooting slow development renders with huge lists:** React 19 development builds in
  Chromium diff changed props for the Performance panel's component track, which is O(n) for an
  `items` array of 100k entries on every render. Production builds and other browsers do not do
  this.
- Sticky items are vertical-only and need the default `elementScroller` for now.
