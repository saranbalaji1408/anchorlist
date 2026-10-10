# anchorlist: virtual list for React with stable scroll anchoring

**anchorlist** is a small virtual list (virtualized list / windowing library) for React. It is
built for chat lists and reverse infinite scroll, so you can prepend items without the scroll
jumping. It also handles infinite feeds and dynamic item heights. Pin a list to its end for chat
or to its start for a feed, with any mix of row sizes. No row height or size estimate is needed.

- Docs: https://saranbalaji1408.github.io/anchorlist/
- Vue and Svelte bindings are planned. The engine (`@anchorlist/core`) is framework-agnostic.

## Install

```sh
npm install anchorlist
```

Requires React 18 or 19.

## Chat (pinned to the end)

```tsx
import { AnchorList } from 'anchorlist'

const renderMessage = (m) => <Message message={m} /> // stable: module scope or useCallback

<AnchorList
  style={{ height: 600 }}
  items={messages}
  getKey={(m) => m.id}
  align="end"                 // opens at the newest message and follows new ones
  hasMoreStart={hasOlder}
  onStartReached={loadOlder}  // prepend older messages; the reader stays in place
  renderItem={renderMessage}
/>
```

## Feed (pinned to the start)

```tsx
import { AnchorList } from 'anchorlist'

const renderPost = (p) => <Post post={p} />

<AnchorList
  style={{ height: '100vh' }}
  items={posts}
  getKey={(p) => p.id}
  hasMoreEnd={hasMore}
  onEndReached={loadMore}     // infinite scroll
  renderItem={renderPost}
/>
```

Keys must be unique and stable. Replace the array on change (`[...older, ...messages]`) instead of
mutating it. Keep `renderItem` stable (module scope or `useCallback`) so a prepend re-renders no
mounted row.

## Features

| | |
| --- | --- |
| Pin to the end (chat) or the start (feed) | `align: 'end' \| 'start'` |
| Prepend / trim / remove without scroll jump | Anchored to an item key and measured in the DOM. If the anchored item is removed, the rows after it hold |
| Follow new items at the pinned edge | Default when pinned; `follow` policy for "jump on my own message" |
| Dynamic heights | Rows measured as they render; `estimateSize` optional |
| Width / keyboard resizes | Re-measured and restored before paint |
| Load more at either edge | `onStartReached` / `onEndReached` |
| Jump to an item | `scrollToKey` stays locked on the target while sizes settle |
| iOS Safari momentum and rubber-band | Corrections deferred through a transform, the fling is not interrupted |
| Restore position | `getSnapshot()` / `initialSnapshot` |
| Accessibility | `aria-posinset` / `aria-setsize` written on rows |
| Size | Hard gzip budgets in CI: React chat path (core + react) ≤ 5.8 kB, currently 5.37 kB; `@anchorlist/react` alone ≤ 1.3 kB, currently 1.01 kB |
| Dependencies | Zero runtime dependencies in core; React is a peer dependency |

## How it compares

| | anchorlist | TanStack Virtual | react-virtuoso |
| --- | --- | --- | --- |
| Chat / end-pinned list | Built in | Implemented by the app | Built in |
| Prepend without scroll jump | Built in, key-based | Implemented by the app | `firstItemIndex` bookkeeping |
| Size estimate required | No | Yes | No |
| Frameworks | React (Vue, Svelte planned) | Many | React |
| Grid, window scroll, sticky | Planned | Yes | Yes |

Feature comparisons are based on each library's public documentation. Head-to-head benchmarks
(scroll stability, frame cost and bundle size, measured in one harness) are planned for v0.2.
Details: [vs TanStack Virtual](https://saranbalaji1408.github.io/anchorlist/compare/tanstack-virtual),
[vs react-virtuoso](https://saranbalaji1408.github.io/anchorlist/compare/react-virtuoso).

## Docs

- [Getting started](https://saranbalaji1408.github.io/anchorlist/guide/getting-started)
- [React chat virtual list with reverse infinite scroll](https://saranbalaji1408.github.io/anchorlist/guide/chat-virtual-list)
- [React infinite scroll feed](https://saranbalaji1408.github.io/anchorlist/guide/feed)
- [Virtualized list with dynamic height](https://saranbalaji1408.github.io/anchorlist/guide/dynamic-height)
- [API reference](https://saranbalaji1408.github.io/anchorlist/api/)
- For AI coding tools: [llms.txt](https://saranbalaji1408.github.io/anchorlist/llms.txt),
  [llms-full.txt](https://saranbalaji1408.github.io/anchorlist/llms-full.txt)

## Packages

- `anchorlist` re-exports `@anchorlist/core` and `@anchorlist/react`.
- [`@anchorlist/core`](https://www.npmjs.com/package/@anchorlist/core): the framework-agnostic engine, zero dependencies.
- [`@anchorlist/react`](https://www.npmjs.com/package/@anchorlist/react): React 18 / 19 bindings.

## Licence

[MIT](https://github.com/saranbalaji1408/anchorlist/blob/main/LICENSE)
