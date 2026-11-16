---
title: React horizontal virtual list with dynamic widths
description: Virtualize a horizontal React list (a carousel, a timeline, a row of cards) with items of any width. Rows are measured as they render, and the item being viewed stays in place when items are added before it.
---

# Horizontal virtual list

A horizontal list scrolls on the x axis: a carousel, a timeline, a strip of thumbnails or a row
of cards. In anchorlist it is the same engine on a different axis. Items can have any width; they
are measured as they render. Items added before the one in view (loading earlier entries of a
timeline) don't move it.

## React

```tsx
import { AnchorList } from 'anchorlist'
import { horizontal } from 'anchorlist/horizontal'
// or: import { horizontal } from '@anchorlist/react/horizontal'

// Module scope: keep the factory stable.
const sideways = horizontal()
const renderCard = (card) => <Card card={card} />

export function Strip({ cards }) {
  return (
    <AnchorList
      scroller={sideways}
      style={{ width: '100%', height: 220 }}
      items={cards}
      getKey={(card) => card.id}
      gap={12}
      renderItem={renderCard}
    />
  )
}
```

`horizontal()` returns a `scroller` factory. On mount it makes the container scroll on the x axis,
lays the rows out in a row and puts `header`, the rows and `footer` side by side at their full
width, then creates the scroller on the horizontal axis.

- **Create the factory in a client component.** `horizontal()` runs where you call it, so a
  Server Component cannot pass its result as a prop. See [React Server Components](./server-rendering#react-server-components).
- **Give the container a width and a height.** Item sizes are widths, and `gap`, `paddingStart`
  and `paddingEnd` are horizontal too.
- `align="start"` (default) pins the list to its left edge; `align="end"` pins it to the right
  edge and follows items appended there, like a chat.
- `scrollToKey(key, { align })`, `scrollToEdge`, `onStartReached` and `onEndReached` work along
  the x axis.
- The `sticky` overlay sticks to the top of the container, so it scrolls away horizontally.

## Right-to-left

Under `dir="rtl"` a horizontal list starts at the right. Pass
[`horizontal(rtlScroller)`](./rtl-virtual-list), which also handles a left-to-right container.

## Without React

Pass `axis: HORIZONTAL` to `elementScroller`, and lay the list out yourself: the container scrolls
on the x axis (`overflow-x: auto; overflow-anchor: none`) and the list is a flex row.

```ts
import { createVirtualizer, elementScroller, HORIZONTAL } from '@anchorlist/core'

v.attach(elementScroller({ element, list, content, axis: HORIZONTAL }))
```

The engine is one-dimensional; every main-axis DOM property comes from the `Axis` object, so a
horizontal list has the same anchoring guarantees as a vertical one.

## Size

`@anchorlist/react/horizontal` is a separate entry of 189 B gzip (budget 300 B, checked in CI).
Vertical lists don't pay for it.

## How it is tested

End-to-end scenarios run horizontal and right-to-left lists in Chromium, WebKit and Firefox, with
React 18 and 19: rows move exactly with a user scroll through unmeasured rows, a row stays still
through prepends and resizes before it, `scrollToKey` reaches the start and the end, an
end-aligned list follows appends, and a header, gaps and padding are laid out along the axis.

## Related

- [RTL virtual list](./rtl-virtual-list)
- [Window scroller](./window-scroller)
- [Dynamic height](./dynamic-height) (the same measuring, along the other axis)
- [API reference: scrollers](/api/#scrollers)
