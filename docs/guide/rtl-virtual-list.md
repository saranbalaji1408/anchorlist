---
title: RTL virtual list for right-to-left layouts (Arabic, Hebrew, Persian)
description: Virtualize a horizontal list in a right-to-left (dir="rtl") layout. rtlScroller starts the list at the right edge and normalises scrollLeft across browsers, so anchoring, scrollToKey and edge triggers work in RTL.
---

# RTL virtual list

In a right-to-left layout (`dir="rtl"`, for Arabic, Hebrew, Persian or Urdu), a horizontal list
starts at the **right** edge and items run leftwards. Browsers also report the horizontal scroll
position differently in RTL. `rtlScroller` handles both, so a right-to-left list gets the same
anchoring, `scrollToKey` and edge triggers as a left-to-right one.

Vertical lists need nothing: they scroll the same way in both directions.

## React

```tsx
import { AnchorList } from 'anchorlist'
import { horizontal } from 'anchorlist/horizontal'
import { rtlScroller } from 'anchorlist/rtl'

// Module scope: keep the factory stable.
const sideways = horizontal(rtlScroller)
const renderCard = (card) => <Card card={card} />

export function Strip({ cards }) {
  return (
    <AnchorList
      scroller={sideways}
      scrollerProps={{ dir: 'rtl' }}
      style={{ width: '100%', height: 220 }}
      items={cards}
      getKey={(card) => card.id}
      renderItem={renderCard}
    />
  )
}
```

- The direction can come from the container (`dir: 'rtl'` in `scrollerProps`) or any ancestor,
  such as `<html dir="rtl">`.
- `horizontal(rtlScroller)` works in both directions: in a left-to-right container it is a plain
  horizontal list. Use it for any horizontal list in an app that supports both.
- The plain `horizontal()` scroller never mirrors. A horizontal list under `dir="rtl"` needs
  `rtlScroller`.
- Create `horizontal(rtlScroller)` in a client component: a Server Component cannot pass the
  result of a call as a prop. See [React Server Components](./server-rendering#react-server-components).
- The direction is read on mount. If the app switches direction at runtime, remount the list, for
  example with `key={dir}`.

## What it does

- Positions are measured from the container's **right** edge; the list's spacers are
  `padding-right` (before the rendered rows) and `padding-left` (after them).
- The scroll offset is normalised to grow leftwards from 0 at the start. Browsers have used three
  conventions for `scrollLeft` in RTL containers: negative values (the standard, in current
  Chromium, WebKit and Firefox), positive values growing leftwards (legacy Edge), and the maximum
  at the start (older Chromium and WebKit). `rtlConvention()` detects the convention once, with a
  throwaway element, when the scroller is created.
- Deferred corrections (during touch scrolling on iOS) are mirrored too.

## Without React

```ts
import { createVirtualizer } from '@anchorlist/core'
import { rtlScroller } from '@anchorlist/core/rtl'

// element: overflow-x: auto; overflow-anchor: none; direction: rtl
v.attach(rtlScroller({ element, list, content }))
```

The list must be a flex row. `rtlScroller` takes the same elements as `elementScroller`; `axis` is
ignored (it is always horizontal).

## Size

`@anchorlist/core/rtl` is a separate entry. It adds 517 B gzip to an app that already uses the
list (budget 600 B, checked in CI).

## How it is tested

End-to-end scenarios run a `dir="rtl"` list in Chromium, WebKit and Firefox, with React 18 and 19,
in the standard negative convention: rows move exactly with a user scroll, a row stays still
through prepends and resizes before it, `scrollToKey` reaches both ends, and a header, gaps and
padding are laid out from the right. Unit tests cover all three `scrollLeft` conventions.

## Related

- [Horizontal virtual list](./horizontal-list)
- [Window scroller](./window-scroller)
- [API reference: scrollers](/api/#scrollers)
