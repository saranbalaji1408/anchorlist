---
title: React infinite scroll feed with a virtualized list
description: Build a virtualized React infinite scroll feed that loads more items at the end, prepends new posts at the top without moving the viewport, and restores the scroll position.
---

# React infinite scroll feed

A feed is a list pinned to its **start**: newest at the top, more loaded as the user scrolls
down. This is anchorlist's default, `align: 'start'`.

Two things are hard in a feed and handled for you:

- **Infinite load at the end**, without a sentinel element or `IntersectionObserver`.
- **New posts arriving at the top while the user reads further down.** The post being read stays
  in place, without a "scroll jump" when the new items are inserted above it.

<!-- react-api:start (assumed React API, see "React API used on this page" below) -->

## Infinite load

```tsx
import { useState } from 'react'
import { AnchorList } from 'anchorlist'

export function Feed({ firstPage, fetchPage }) {
  const [posts, setPosts] = useState(firstPage.items)
  const [cursor, setCursor] = useState(firstPage.next)
  const [loading, setLoading] = useState(false)

  async function loadMore() {
    if (loading || !cursor) return
    setLoading(true)
    const page = await fetchPage(cursor)
    setPosts((current) => [...current, ...page.items])
    setCursor(page.next)
    setLoading(false)
  }

  return (
    <AnchorList
      style={{ height: '100vh' }}
      items={posts}
      getKey={(post) => post.id}
      gap={12}
      hasMoreEnd={cursor != null}
      onEndReached={loadMore}
      footer={loading ? <Spinner /> : null}
      renderItem={(post) => <PostCard post={post} />}
    />
  )
}
```

`onEndReached` fires when the viewport comes within `endThreshold` (default 300 px) of the end and
`hasMoreEnd` is true. It fires again if a page arrived but the viewport is still near the end, so a
tall screen fills up with short pages.

## New posts at the top

```tsx
setPosts((current) => [...fresh, ...current])
```

- **At the top (pinned):** the list follows and shows the new posts.
- **Scrolled down:** the post being read stays exactly where it is, and the new posts are added
  above, out of view. Pass `follow={false}` to never follow, or `follow={true}` to always jump to
  the top.

To show a "N new posts" pill, keep the count in state and call `scrollToEdge('start')` from the
pill.

## Restore the scroll position

When the user leaves the feed and comes back, save the position and pass it back:

```tsx
const saved = useRef<Snapshot>()

<AnchorList
  ref={list}
  initialSnapshot={saved.current}
  // ...
/>

// before unmount, or when navigating away:
saved.current = list.current?.getSnapshot()
```

A snapshot is `{ key, index, delta, pinned }`, plain serializable data. You can keep it in
`history.state` or `sessionStorage`. It is restored exactly once the anchored row has been
measured. If that key is gone, the item now at the same index is used.

::: details React API used on this page
These names are not final until `@anchorlist/react` is published:
`AnchorList`, `items`, `getKey(item)`, `renderItem(item)`, `footer`, `style`, `ref` with an
`AnchorListHandle` exposing `getSnapshot` and `scrollToEdge`. The rest (`gap`, `hasMoreEnd`,
`onEndReached`, `follow`, `initialSnapshot`, `endThreshold`) are [core options](/api/#options)
passed through unchanged. `Snapshot` is a core type.
:::

<!-- react-api:end -->

## Long feeds and memory

Rendering cost depends on the viewport, not on the list length. Only the rows in the viewport plus
`overscan` (default 400 px on each side) are mounted. To bound memory in very long sessions, trim
items from the far end of the array. The engine treats a trim like a prepend: the visible post
does not move. `maxCachedSizes` caps how many measured sizes are kept.

The engine's 100k-item micro-benchmark on Apple M2, Node 24 and a simulated scroller, recorded in
the core design notes:

| Operation (100k items) | Result |
| --- | --- |
| Mount to the first settled frame | 32–36 ms |
| Scroll frame (37 px per frame) | p50 14–16 µs, p95 44–48 µs |
| 50-item prepend while anchored | p50 70–90 µs, p95 207–239 µs |

These numbers are for the engine with a minimal host. React adds its own render cost. A
head-to-head benchmark against other libraries is planned for v0.2.

## Related

- [Getting started](./getting-started)
- [React chat virtual list](./chat-virtual-list) (the same engine, pinned to the end)
- [Dynamic height](./dynamic-height)
- [API reference](/api/)
