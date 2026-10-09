---
title: Getting started with anchorlist, a React virtual list
description: Install anchorlist and render a virtualized React chat list or infinite feed with stable scroll anchoring and dynamic item heights in a few lines.
---

# Getting started

anchorlist is a virtual list (windowing library) for React that keeps the scroll position stable.
You can pin a list to its **end** for chat, where new messages arrive at the bottom and history
loads upwards, or to its **start** for a feed. Rows can have any mix of heights. They are measured
as they render, so you don't need a fixed row height.

::: tip Status
v0.1 ships the framework-agnostic core (`@anchorlist/core`) and React bindings
(`@anchorlist/react`). Vue and Svelte bindings are planned.
:::

## Install

```sh
npm install anchorlist
# or
pnpm add anchorlist
# or
yarn add anchorlist
```

`anchorlist` re-exports `@anchorlist/core` and `@anchorlist/react`. If you only need one of them,
install it directly. React 18 and 19 are supported as peer dependencies.

<!-- react-api:start (assumed React API, see "React API used on this page" below) -->

## A chat list (pinned to the end)

```tsx
import { AnchorList } from 'anchorlist'

function Chat({ messages, hasOlder, loadOlder }) {
  return (
    <AnchorList
      style={{ height: 600 }}
      items={messages}
      getKey={(message) => message.id}
      align="end"
      hasMoreStart={hasOlder}
      onStartReached={loadOlder}
      renderItem={(message) => <Message message={message} />}
    />
  )
}
```

The list opens at the newest message and stays pinned there while new messages arrive. When the
user scrolls up, `onStartReached` fires. Older messages are then prepended and the message being
read stays where it is. More in the [chat guide](./chat-virtual-list).

## A feed (pinned to the start)

```tsx
import { AnchorList } from 'anchorlist'

function Feed({ posts, hasMore, loadMore }) {
  return (
    <AnchorList
      style={{ height: '100vh' }}
      items={posts}
      getKey={(post) => post.id}
      hasMoreEnd={hasMore}
      onEndReached={loadMore}
      renderItem={(post) => <Post post={post} />}
    />
  )
}
```

`align` defaults to `'start'`. More in the [feed guide](./feed).

::: details React API used on this page
These names are not final until `@anchorlist/react` is published:
`AnchorList`, `items`, `getKey(item)`, `renderItem(item)`, `style`. The rest (`align`,
`hasMoreStart`, `hasMoreEnd`, `onStartReached`, `onEndReached`) are
[core options](/api/#options) passed through unchanged.
:::

<!-- react-api:end -->

## Rules that keep scrolling stable

- **Give every item a unique, stable key.** The viewport is anchored to a key, not an index, so
  keys must not change when items move.
- **Replace arrays instead of mutating them.** Use `setMessages((m) => [...older, ...m])`, not
  `messages.unshift(...)`. The engine compares the previous and next list to detect prepends and
  trims.
- **Give the list a bounded height** (a fixed height, or a flex child with `min-height: 0`). The
  list scrolls inside its own container.
- **Put row margins inside the row**, or use the `gap` option. A row's size is its border box.
- **Don't set `scrollTop` yourself.** Use `scrollToKey` / `scrollToEdge`.

## Next steps

- [React chat virtual list](./chat-virtual-list): follow new messages, prepend history, keyboard
  resizes.
- [Infinite feed](./feed): load more at the end, restore position.
- [Dynamic height](./dynamic-height): measured rows, no estimate needed.
- [API reference](/api/)
- How it compares: [TanStack Virtual](/compare/tanstack-virtual), [react-virtuoso](/compare/react-virtuoso)
