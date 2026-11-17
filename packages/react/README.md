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
  `className`, `style`, `rowClassName`, `scrollerProps`, plus every core option (`align`, `gap`,
  `overscan`, `follow`, `hasMoreStart`, `onEndReached`, `initialSnapshot`, ...).
- **Ref:** `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`,
  `getVisibleRange`, `getItemRect`, `getTotalSize`, `indexOf`, `subscribe`.
- **Rows get no index**, so a prepend re-renders no mounted row. Keep `renderItem` stable (module
  scope or `useCallback`) and keep item objects immutable to get that benefit.
- **Headless:** `useAnchorList(options, elements)` returns `[virtualizer, plan]` for custom markup.
- StrictMode and concurrent rendering (`startTransition`) are supported.
