---
title: Smooth scroll to an item in a React virtual list
description: Animate a virtualized React list to any item, including items that are far away and not rendered yet. animateToKey lands exactly, respects prefers-reduced-motion and stops when the user scrolls.
---

# Smooth scroll to an item

`scrollToKey` jumps. To animate instead (a "jump to message" link, a table of contents, a search
result), use `animateToKey`. It works for items that are thousands of rows away and not rendered,
and lands exactly on the item even though the rows on the way have never been measured.

## React

```tsx
import { useRef } from 'react'
import { AnchorList, type AnchorListHandle } from 'anchorlist'
import { animateToKey } from 'anchorlist/animate'
// or: import { animateToKey } from '@anchorlist/core/animate'

export function Thread({ messages }) {
  const list = useRef<AnchorListHandle>(null)

  function jumpTo(id) {
    const handle = list.current
    if (handle) void animateToKey(handle, handle.element, id, { align: 'center' })
  }

  return <AnchorList ref={list} items={messages} getKey={(m) => m.id} align="end" renderItem={renderMessage} />
}
```

The handle is the virtualizer, and `handle.element` is the scroll container. `animateToKey`
returns a promise: `true` once it has landed, `false` if it was cancelled or the item doesn't
exist.

## Options

| Option | Default | |
| --- | --- | --- |
| `align` | `'start'` | Where the item lands: `'start'`, `'center'` or `'end'` of the viewport. |
| `offset` | `0` | Extra px added to the landing position. |
| `duration` | `400` | Milliseconds. `0` or less jumps at once. |
| `easing` | ease in-out cubic | `(t) => progress`, both from 0 to 1. |
| `signal` | | An `AbortSignal`; aborting cancels the animation. |

## How it lands exactly

The rows between here and the target have estimated sizes until they render. On every animation
frame `animateToKey` recomputes the target from the engine's current layout, and covers the eased
share of the remaining distance, so a target that moves as rows are measured is still met at the
end. The last frame hands over to `scrollToKey`, which lands exactly and stays locked on the item
while the rows around it settle.

Each frame scrolls like a user would, so the rows on screen stay anchored while rows mount on the
way.

## Cancelling and reduced motion

- A `wheel`, `touchstart`, `pointerdown` or `keydown` on the scroll container stops the
  animation where it is, as the user expects. With a `windowScroller`, the same input anywhere on
  the page stops it. The event that started the animation (a keyboard shortcut, say) does not.
- A new `animateToKey` on the same container replaces the running one.
- If the item is removed on the way, or the list unmounts, it stops and resolves `false`.
- With `prefers-reduced-motion: reduce`, it jumps at once instead of animating.

## Limits

`element` must be the scroll container itself. For a window-scrolled, horizontal or
right-to-left list, pass the same kind of scroller as the list's in the `scroller` option (for
example `windowScroller({ list })` or `rtlScroller({ element, list })`), so the animation reads
and writes the offset the way the list does.

## Size

`@anchorlist/core/animate` is a separate entry of 789 B gzip (budget 800 B). Lists that only
jump don't load it.

## How it is tested

End-to-end scenarios in Chromium, WebKit and Firefox, with React 18 and 19: an animation reaches
a row 2,000 rows away that was never rendered and lands exactly, for both `align` values; it
scrolls upwards in a chat list and applies the offset; user input cancels it where it is; and it
jumps without animating when the user prefers reduced motion.

## Related

- [React chat virtual list](./chat-virtual-list#jump-to-the-latest-or-to-a-message)
- [API reference: smooth scrolling](/api/#smooth-scrolling)
