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
  `className`, `style`, `rowClassName`, `scrollerProps`, `busy` (`aria-busy`), plus every core
  option (`align`, `gap`, `overscan`, `follow`, `hasMoreStart`, `onEndReached`, `initialSnapshot`,
  `initialRect`, ...).
- **Ref:** `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`,
  `getVisibleRange`, `getItemRect`, `getTotalSize`, `indexOf`, `subscribe`, and the scroll
  container as `element`.
- **Focus:** the row containing focus stays mounted while scrolled out of view.
- **Server rendering:** with `initialRect`, the server and hydration renders include the rows that
  fill it.
- **Sticky items** (group headers): `StickyItem` from `@anchorlist/react/sticky`, returned from
  `sticky`:
  `sticky={(range) => <StickyItem range={range} items={rows} isSticky={isHeader} renderItem={renderRow} />}`.
- **Smooth scrolling:** `animateToKey(ref.current, ref.current.element, key)` from
  `@anchorlist/core/animate`.
- **Restoring with sizes:** `takeSnapshot` / `snapshotEstimate` from `@anchorlist/core/snapshot`.
- **Rows get no index**, so a prepend re-renders no mounted row. Keep `renderItem` stable (module
  scope or `useCallback`) and keep item objects immutable to get that benefit.
- **Headless:** `useAnchorList(options, elements)` returns `[virtualizer, plan]` for custom markup.
- StrictMode and concurrent rendering (`startTransition`) are supported.
- **Troubleshooting slow development renders with huge lists:** React 19 development builds in
  Chromium diff changed props for the Performance panel's component track, which is O(n) for an
  `items` array of 100k entries on every render. Production builds and other browsers do not do
  this.
- Sticky items, the kept focused row and `initialRect` are vertical-only for now.
