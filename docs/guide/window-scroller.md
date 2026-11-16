---
title: React window scroller virtual list (scroll with the page)
description: Virtualize a long React list that scrolls with the page instead of its own container. windowScroller keeps the row being read in place, supports a fixed app bar with scrollMargin, and works for chats and feeds.
---

# Window scroller: a virtual list that scrolls with the page

Most virtual lists scroll inside a container with a fixed height. Many pages scroll as a whole:
a feed under a site header, a long article's comment thread, a search results page. With
`windowScroller` the list uses the **window's scroll position** instead of its own, and the page
content around it behaves like the list's header and footer.

Everything else stays the same: rows are measured as they render, prepends and resizes above the
reader don't move the row being read, and `align: 'end'` pins the list to the bottom of the page.

## React

```tsx
import { AnchorList } from 'anchorlist'
import { windowScroller } from 'anchorlist/window'
// or: import { windowScroller } from '@anchorlist/core/window'

const renderPost = (post) => <PostCard post={post} />

export function Feed({ posts, hasMore, loadMore }) {
  return (
    <AnchorList
      scroller={windowScroller}
      items={posts}
      getKey={(post) => post.id}
      hasMoreEnd={hasMore}
      onEndReached={loadMore}
      renderItem={renderPost}
    />
  )
}
```

- **No height on the list.** The container grows with its rows; the page scrolls.
- With a custom `scroller`, `AnchorList` adds no `overflow` style to its container, so it is not a
  scroll container. Don't give it one.
- `scroller` is read once, on mount.

## A fixed app bar: `scrollMargin`

If fixed or sticky UI covers the top of the window (an app bar), pass its height as
`scrollMargin`. The list then treats the viewport as starting below the bar: the row being read
is anchored to the bar's lower edge, `scrollToKey(key)` puts the row just under the bar, and the
visible range excludes what the bar covers.

```tsx
// Module scope: keep the factory stable.
const belowAppBar = (elements) => windowScroller({ ...elements, scrollMargin: 56 })

<AnchorList scroller={belowAppBar} /* ... */ />
```

`scrollMargin` works like CSS `scroll-padding`. It is **not** the list's distance from the top of
the page: anchorlist measures where the list starts, so a header above the list needs no option.
If you are coming from a virtualizer whose `scrollMargin` means the list's offset, don't pass that
number here.

`scrollMargin` is read when the scroller is created. To change it (a responsive app bar),
remount the list, for example with a `key`.

## Chat that scrolls with the page

`align="end"` works with the window too: the page opens at the bottom, follows new messages while
the reader is at the bottom, and loads history upwards without moving the message being read.

```tsx
<AnchorList
  scroller={windowScroller}
  align="end"
  items={messages}
  getKey={(m) => m.id}
  hasMoreStart={hasOlder}
  onStartReached={loadOlder}
  renderItem={renderMessage}
/>
```

There is no inset for fixed UI at the **bottom** of the window. For a fixed composer, render a
spacer of the composer's height after the list: page content after the list counts as its
footer, so the last message ends above the composer.

## A page that is already scrolled

When an `align="start"` list mounts on a page that is already scrolled (a feed that mounts lazily
below other content, or a page whose scroll position the browser restored), it keeps the page
where it is. It anchors to the row at the viewport, or holds still when the list is still below
the viewport. It does not scroll the page to the top.

To restore a position you saved yourself, pass `initialSnapshot` as with any list. See
[restore the scroll position](./feed#restore-the-scroll-position).

## Without React

`windowScroller` is a scroller like `elementScroller`. Create the virtualizer as usual and attach
it:

```ts
import { createVirtualizer } from '@anchorlist/core'
import { windowScroller } from '@anchorlist/core/window'

const v = createVirtualizer(options, { render })
v.attach(windowScroller({ list, content, scrollMargin: 56 }))
```

- `list` is the element that directly contains the rows; `content` wraps the list's own header
  and footer (default `list`).
- It sets `overflow-anchor: none` on `content` while the list is attached (and restores your value on detach), so the browser's own scroll anchoring stays on
  for the rest of the page but leaves the rows alone. If you wrap `windowScroller`, keep that
  style on an ancestor of the rows.
- It listens to `scroll` and `resize` on `window`, and to input events on the document element.
- `axis: HORIZONTAL` makes a horizontal list that scrolls with the page.

## Size

`@anchorlist/core/window` is a separate entry, so apps that don't use it don't pay for it. It
adds 391 B gzip to an app that already uses the list (budget 600 B, checked in CI). It reuses the
list's `elementScroller` code.

## How it is tested

End-to-end scenarios run the window scroller in Chromium, WebKit and Firefox, with React 18 and
19, with and without a 56 px fixed bar: rows move exactly with the page scroll, only the rows near
the window are mounted, a row stays still through prepends and resizes above it, `scrollToKey`
lands below the bar, an end-aligned list pins to the bottom of the page and follows appends, and
mounting on an already scrolled page keeps the page in place.

## Related

- [Infinite scroll feed](./feed)
- [React chat virtual list](./chat-virtual-list)
- [Horizontal virtual list](./horizontal-list)
- [API reference: scrollers](/api/#scrollers)
