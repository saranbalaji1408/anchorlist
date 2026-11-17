---
title: Accessible virtual list in React (focus, ARIA, screen readers)
description: How anchorlist keeps a virtualized React list accessible. The focused row stays mounted while scrolled away, rows get aria-posinset and aria-setsize, aria-busy marks loading, and sticky copies stay out of the accessibility tree.
---

# Accessibility and focus

Virtualization removes rows from the DOM, which can break keyboard focus and confuse screen
readers. anchorlist handles the parts a list can handle itself.

## Focus stays where it is

When a row contains focus (a button, a link, an input in a message) and the user scrolls it out of
the rendered range, unmounting it would blur it: the next Tab would start from the top of the page
and a screen reader would lose its place.

`AnchorList` keeps the focused row mounted while it is outside the rendered range. It is moved
out of the flow, at its own position, so it doesn't take space between the rendered rows. React
never re-creates its DOM node, so focus and the screen reader position survive. When focus leaves
the list, the row unmounts normally.

This is automatic. If focus leaves the browser window (switching apps), the row stays kept.

## Position in the set

The list has `role="list"` and every row `role="listitem"`. Because only some rows exist in the
DOM, each row also gets `aria-posinset` (its position, from 1) and `aria-setsize` (the number of
items), so screen readers announce "item 412 of 2,000" instead of "item 3 of 20". While more items
can load (`hasMoreStart` or `hasMoreEnd` is true), the total is unknown and `aria-setsize` is
`-1`, as ARIA specifies.

## Loading

Set `busy` while a page of items is loading. It sets `aria-busy` on the list, so assistive
technology waits for the update instead of announcing a half-loaded list.

```tsx
<AnchorList busy={loading} hasMoreEnd={hasMore} onEndReached={loadMore} /* ... */ />
```

## Sticky headers

The copy that [sticky headers](./sticky-headers) show at the top of the viewport is `aria-hidden`
and `inert`: screen readers read each header once, in its row, and keyboard focus never lands in
the copy.

## Motion

[`animateToKey`](./smooth-scroll) jumps instead of animating when the user prefers reduced
motion.

## What stays your job

- Give the scroll container an accessible name (`'aria-label': 'Messages'` in `scrollerProps`)
  and make it focusable if users should scroll it with the keyboard (`tabIndex: 0` in
  `scrollerProps`).
- For a chat, announce new messages with your own live region; the list doesn't announce
  insertions.

## Limits

The kept focused row stays at its own position in vertical, horizontal, right-to-left and
window-scrolled lists. Sticky items have their own [limits](/guide/sticky-headers#limits).

## How it is tested

End-to-end scenarios in Chromium, WebKit and Firefox, with React 18 and 19: the focused row stays
mounted and focused while scrolled far away, for both `align` values; a kept row doesn't disturb
anchoring through a prepend; the row unmounts once focus leaves the list; and `aria-busy` follows
`busy`.

## Related

- [Sticky group headers](./sticky-headers)
- [API reference: focus preservation](/api/#focus-preservation)
