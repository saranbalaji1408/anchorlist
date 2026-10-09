---
title: React chat virtual list with reverse infinite scroll
description: Build a virtualized React chat list that sticks to the newest message, loads older messages with reverse infinite scroll without scroll jump, and stays stable through keyboard and image resizes.
---

# React chat virtual list with reverse infinite scroll

A chat UI asks a lot of a virtual list:

- it opens at the newest message;
- it follows new messages while the user is at the bottom;
- it loads history upwards (reverse infinite scroll) without the viewport jumping;
- it copes with bubbles that change height after images or embeds load, and with an on-screen
  keyboard that shrinks the viewport.

With anchorlist you get all of this from one option: `align: 'end'`.

## How it works

The viewport is anchored to a **message key**, not to a pixel offset or an index. On every change
the engine measures the rendered rows in the DOM and puts the anchor message back where it was
before the browser paints. Prepends, trims, row resizes, width changes and removing the anchored
message itself all leave the message you are reading in place. The engine's fuzz test checks this
to within 0.5 px after every random operation (see [How it is tested](#how-it-is-tested)).

## Basic chat list

```tsx
import { useState } from 'react'
import { AnchorList } from 'anchorlist'

// Module scope keeps the function stable, so mounted rows don't re-render.
const renderMessage = (message) => <MessageBubble message={message} />

export function Chat({ initial, fetchOlder }) {
  const [messages, setMessages] = useState(initial)
  const [hasOlder, setHasOlder] = useState(true)
  const [loading, setLoading] = useState(false)

  async function loadOlder() {
    if (loading) return
    setLoading(true)
    const older = await fetchOlder(messages[0].id)
    setMessages((current) => [...older, ...current]) // new array, never unshift
    setHasOlder(older.length > 0)
    setLoading(false)
  }

  return (
    <AnchorList
      style={{ height: '100%' }}
      items={messages}
      getKey={(message) => message.id}
      align="end"
      hasMoreStart={hasOlder}
      onStartReached={loadOlder}
      header={loading ? <Spinner /> : null}
      renderItem={renderMessage}
    />
  )
}
```

## Prepend older messages without scroll jump

`onStartReached` fires when the viewport comes within `startThreshold` (default 300 px) of the
top and `hasMoreStart` is true. It fires again if a page arrived and the viewport is still near the
top, so short pages keep loading until the viewport is filled.

When the new array has extra items at the front, the engine detects the prepend from the keys.
Mounted rows are not re-rendered. The message at the top of the viewport keeps its position,
including after the new rows have been measured. You don't need `firstItemIndex` bookkeeping or to
fix up `scrollTop` yourself.

Pass `hasMoreStart={false}` once the history is exhausted. While `hasMoreStart` is true the list
cannot pin to the top, and `aria-setsize` is reported as `-1` (unknown).

## Follow new messages

By default the list stays pinned to the bottom when it was pinned. If the user scrolled up to
read history, new messages are added below without moving the viewport. Use `follow` to change
this:

```tsx
<AnchorList
  // ...
  follow={({ atEdge }) => atEdge || lastMessageIsMine(messages)}
/>
```

- `follow={true}` or a function returning `true` jumps to the bottom and pins, for example when
  the user sends a message.
- `follow={false}` stops following and keeps the content in place.
- The function receives `{ atEdge, added, count }`, where `added` is the number of new items. It may run more than once per update, so it
  must be pure.

Trimming old messages at the top in the same update (to keep memory bounded) does not break
following.

## Jump to the latest, or to a message

```tsx
const list = useRef<AnchorListHandle>(null)

<AnchorList ref={list} /* ... */ />

list.current?.scrollToEdge()                        // newest message, pins again
list.current?.scrollToKey(replyId, { align: 'center' })
```

`scrollToKey` positions at the estimated offset immediately (no blank frame), then stays locked
on the target while the surrounding rows are measured. User input cancels the lock.

To show a "jump to latest" button, listen to `onAtEdgeChange`:

```tsx
const [atBottom, setAtBottom] = useState(true)

<AnchorList onAtEdgeChange={setAtBottom} /* ... */ />
{!atBottom && <button onClick={() => list.current?.scrollToEdge()}>Latest</button>}
```

## Sticky date pill

`sticky` renders an overlay pinned to the top of the viewport from the visible range. It
re-renders only when that range changes:

```tsx
<AnchorList
  // ...
  sticky={(range) => <DatePill messageId={range.startKey} />}
/>
```

## Keyboard and viewport resizes

With `align: 'end'`, when the viewport height changes, content keeps its distance from the
**bottom** of the viewport. When an on-screen keyboard opens and the container shrinks, the last
visible message stays above the composer. When the window is resized, the conversation doesn't
drift.

A **width** change (rotating a phone, resizing a sidebar) re-wraps text and changes every row's
height. The engine marks all cached sizes stale, re-measures the mounted rows in the same
`ResizeObserver` callback and restores the anchor before paint. See
[dynamic height](./dynamic-height).

## Images and embeds that load later

When a bubble grows after its image loads, it is re-measured and the anchor is corrected in the
same callback. In an end-aligned list the anchored message's bottom edge is held fixed, so a
growing bubble grows upwards, as users expect in a chat.

## iOS Safari and momentum scrolling

Writing `scrollTop` during iOS momentum scrolling stops the fling. During a touch, and while the
list is rubber-banding past an edge, anchorlist holds corrections as a `transform` on the content
wrapper. It commits them to the scroll offset when scrolling ends. The visual position is the same
either way, and `onStartReached` is not fired while overscrolled.

## Layout rules

- The scroller needs a bounded height. In a flex column, give it `flex: 1; min-height: 0`.
- Put spacing between bubbles inside the row or use the `gap` option, not `margin` on the row.
- Don't put borders on the list's main axis, and don't set `scrollTop` yourself.

## How it is tested

The core runs a seeded fuzz test with 19 operation types (prepend, append, trims, resizes, anchor
removal, width changes, touches and more) for both `align: 'end'` and `align: 'start'`. After every
operation, the anchor must stay within 0.5 px of where it was. CI runs 10,000 operations per
configuration. A one-off offline sweep over 20 seeds ran 1.2 million operations and made 921,706
drift checks with 0 failures. End-to-end scenarios run in Chromium, WebKit and Firefox.

## Related

- [Infinite feed (top-anchored)](./feed)
- [Dynamic height](./dynamic-height)
- [API reference](/api/)
- [anchorlist vs react-virtuoso](/compare/react-virtuoso)
