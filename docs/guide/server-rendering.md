---
title: Server-side rendering a React virtual list (SSR and hydration)
description: Render the first rows of a virtualized React list on the server (Next.js, Remix, any SSR) and hydrate without a mismatch. Opt-in with initialRect and initialPlan; restores a saved position too.
---

# Server rendering and hydration

A virtual list renders only the rows near the viewport, and the server doesn't know the viewport.
By default anchorlist renders **no rows** on the server and fills the list after hydration. To put
the first screen of rows into the server HTML (for faster first paint and for crawlers), tell it
what viewport to assume.

## React

```tsx
import { AnchorList } from 'anchorlist'
import { initialPlan } from 'anchorlist/ssr'

const SCREEN = { width: 400, height: 800 }

export function Feed({ posts }) {
  return (
    <AnchorList
      style={{ height: '100vh' }}
      items={posts}
      getKey={(post) => post.id}
      estimateSize={() => 120}
      initialRect={SCREEN}
      initialPlan={initialPlan}
      renderItem={renderPost}
    />
  )
}
```

- `initialRect` is the viewport size to assume before the list is attached. The larger of
  `width` and `height` is read, so it serves vertical and horizontal lists alike (at worst a few
  extra rows).
- `initialPlan` renders the rows that fill that size from the `align` edge, sized by
  `estimateSize` (default 48 px). It is deterministic, so the server render and the hydration
  render produce the same rows and React adopts the server markup without a mismatch.
- After hydration the engine takes over: it measures the rows, writes the spacers and the scroll
  offset, and renders more rows for the overscan.

A good `estimateSize` makes the server render closer to what the client shows. Too low an estimate
renders more rows than fit; too high renders fewer.

Server rendering is opt-in: lists that don't pass `initialPlan` carry none of its code.

## React Server Components

The `anchorlist` and `@anchorlist/react` entries are client modules (`'use client'`); the
`@anchorlist/core` entries are not. A Server Component can only pass a function prop to
`AnchorList` when it is a client reference, so import such functions from an `anchorlist/*` or
`@anchorlist/react/*` entry: `initialPlan` from `anchorlist/ssr`, not `@anchorlist/core/ssr`.
The `@anchorlist/core/*` entries export plain functions, which React refuses to serialise from a
Server Component; use them in client files or outside React. Props you write yourself, such as
`renderItem` and `getKey`, are plain functions too, so in practice `AnchorList` is rendered from a
client component, where any entry works.

The same rule covers `scroller`. `windowScroller` from `anchorlist/window` and `rtlScroller` from
`anchorlist/rtl` can be passed as they are. A scroller made by a call, such as `horizontal()`,
`horizontal(rtlScroller)` or a wrapper like `(elements) => windowScroller({ ...elements,
scrollMargin: 56 })`, is a plain function created where the call runs, so create it in a client
component.

## Restoring a position

With `initialSnapshot`, the server HTML starts at the snapshot's item instead of the edge, so a
restored page doesn't flash the top of the list first. Hydration then restores the exact position
(the item's offset within the viewport), which moves the content by at most that offset.

## What the server HTML looks like

The server markup has no spacers and no scroll offset, so before hydration the rows sit at the top
of the scroll container. For `align: 'end'` (chat), the newest rows are therefore top-aligned until
hydration pins them to the bottom. The `data-index` and `aria-*` attributes are written after
hydration.

## Limits

- `initialPlan` fills the larger side of `initialRect`, which can render a few more rows than a
  wide, short horizontal list needs.
- Layout effects don't run on the server; anchorlist uses a passive effect where there is no DOM,
  so React doesn't warn.

## Size

`@anchorlist/core/ssr` is a separate entry of 379 B gzip (budget 400 B).

## How it is tested

End-to-end scenarios in Chromium, WebKit and Firefox, with React 18 and 19, render the list with
`renderToString` and hydrate it with `hydrateRoot`: the server HTML has the rows for `initialRect`
from the `align` edge for both `align` values, hydration adopts the server nodes without a
mismatch, the engine then pins and anchors as usual, a server render with `initialSnapshot` starts
at the snapshot item and hydration restores it exactly, and without `initialRect` the server HTML
has no rows.

## Related

- [Restore the scroll position](./feed#restore-the-scroll-position)
- [API reference: server rendering](/api/#server-rendering)
