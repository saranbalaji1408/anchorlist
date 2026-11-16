---
title: React virtual grid and masonry layout with dynamic heights
description: Virtualize a React grid or a masonry (Pinterest-style) layout with items of any height. Only the items near the viewport are mounted, items are measured as they render, and the item being viewed stays in place when items are prepended.
---

# Virtual grid and masonry

A grid of cards or a masonry wall of photos can hold thousands of items. anchorlist mounts only
the items near the viewport, measures them as they render (no fixed row height) and keeps the item
being viewed in place when items are added above it, the same way it does for a plain list.

- **Grid:** items fill rows in order; a row is as tall as its tallest item.
- **Masonry:** each item goes into the column that ends first, so columns of uneven items stay
  packed.

Both are lane layouts from `@anchorlist/core/lanes`. Lanes are columns for a vertical list and rows
for a horizontal one.

## React virtual grid

```tsx
import { useState } from 'react'
import { LanesList, grid } from 'anchorlist/lanes'
// or: import { grid } from '@anchorlist/core/lanes' and { LanesList } from '@anchorlist/react/lanes'

// Module scope: a stable renderItem means a prepend re-renders no mounted item.
const renderProduct = (product) => <ProductCard product={product} />

export function ProductGrid({ products }) {
  // One layout per list, created once.
  const [lanes] = useState(() => grid({ lanes: 4, gap: 16 }))
  return (
    <LanesList
      lanes={lanes}
      style={{ height: '80vh' }}
      items={products}
      getKey={(product) => product.id}
      renderItem={renderProduct}
    />
  )
}
```

`LanesList` takes every [`AnchorList` prop](/api/#anchorlist-props) plus `lanes`. Items are
positioned absolutely in their lane; each lane is an equal share of the container's width, so
lanes follow width changes without a re-render. A grid always renders whole rows.

## React masonry layout

```tsx
import { useState } from 'react'
import { LanesList, masonry } from 'anchorlist/lanes'

const estimatePhoto = () => 300
const renderPhoto = (photo) => <img src={photo.src} alt={photo.alt} style={{ width: '100%', aspectRatio: photo.ratio }} />

export function PhotoWall({ photos }) {
  const [lanes] = useState(() => masonry({ lanes: 3, gap: 8 }))
  return (
    <LanesList
      lanes={lanes}
      style={{ height: '100vh' }}
      items={photos}
      getKey={(photo) => photo.id}
      estimateSize={estimatePhoto}
      renderItem={renderPhoto}
    />
  )
}
```

Give images a size before they load (`aspect-ratio`, or `width` and `height` attributes), so an
item is measured at its final height. A size that changes later is still handled: the items after
it are laid out again, and the item being viewed keeps its position.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `lanes` | (required) | Number of lanes: columns, or rows when `horizontal`. At least 1. |
| `gap` | `0` | Gap between lanes and between items in a lane, in px. |
| `horizontal` | `false` | Lanes are rows and items run horizontally. Use it with `scroller={horizontal()}`. |

`estimateSize` is the size of one item (default 48 px); the layout converts it for the engine.

## What works as in a plain list

- **Anchoring:** prepends, trims, appends and resizes keep the item at the top of the viewport
  still, so infinite loading in both directions works (`hasMoreStart`, `onStartReached`,
  `hasMoreEnd`, `onEndReached`).
- **`align="end"`** pins the grid to its newest items.
- **`scrollToKey`** lands on an item that isn't mounted yet, through unmeasured items.
- **Focus:** an item that contains focus stays mounted at its lane position while scrolled away.
- **Any scroller:** the layout wraps the scroller, so `scroller={windowScroller}` (from
  `anchorlist/window`) scrolls the grid with the page, and `grid({ lanes: 2, horizontal: true })`
  with `scroller={horizontal()}` makes a horizontal grid.

## Limits

- **Keep `overscan` (default 400 px) at least as large as the largest item.** A masonry item can
  start up to one item before or after where the engine places it.
- **No list padding.** `paddingStart` and `paddingEnd` are ignored and `gap` belongs to the
  layout. Use a `header` or `footer` for space at the edges.
- Inserting a number of items that isn't a whole row before the viewport (grid), or any change
  before it (masonry), lays out the items after it again, so they may change lanes. The item being
  viewed keeps its position.

## Without React

```ts
import { createVirtualizer, elementScroller } from '@anchorlist/core'
import { masonry } from '@anchorlist/core/lanes'

const lanes = masonry({ lanes: 3, gap: 8 })                     // once per list
const plan = v.plan(lanes.options(options))                      // render: pure
// render items lanes.range(plan, options.count), keyed, in a list with position: relative
lanes.sync(options)                                              // commit phase, before commit()
if (!attached) v.attach(lanes.scroller(elementScroller(els)))    // once
v.commit(plan)
```

The engine stays one-dimensional. A grid reports each row's size on the row's first item, and
masonry reports each item's share of the main axis, so anchoring, edges and scrolling need no
special case. See the [API reference](/api/#lanes) for the full contract.

## Size

`@anchorlist/core/lanes` is a separate entry of 1,365 B gzip (budget 1.5 kB) and
`@anchorlist/react/lanes` adds 358 B on top of `AnchorList` (budget 400 B), both checked in CI. A
CI check also bundles the plain list import and fails if any lanes code ends up in it, so lists
that don't use lanes don't pay for them.

## How it is tested

Property tests check grid and masonry against naive layouts over prepends, appends, trims,
replacements and measurements. End-to-end scenarios run grid and masonry lists in Chromium, WebKit
and Firefox, with React 18 and 19: items sit where a reference layout puts them and never overlap,
the viewport stays covered after jumps over unmeasured items, items move exactly with a user
scroll, an item stays still through prepends and resizes above it, a focused item stays mounted at
its lane position without changing the scroll size, a grid renders whole rows even when a row is
taller than the overscan, and `scrollToKey` and `align="end"` land where expected.

## Related

- [Dynamic height](./dynamic-height)
- [Infinite scroll feed](./feed)
- [Window scroller](./window-scroller)
- [Horizontal virtual list](./horizontal-list)
- [API reference: lanes](/api/#lanes)
