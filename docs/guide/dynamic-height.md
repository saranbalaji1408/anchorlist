---
title: Virtualized list with dynamic height in React
description: Virtualize React rows of unknown, variable height. anchorlist measures rows as they render, needs no size estimate, and keeps the scroll position stable when rows or the width change.
---

# Virtualized list with dynamic height

Most virtual lists assume a fixed row height or ask you to estimate one. When the estimate is
wrong, the scrollbar jumps and content moves as rows are measured. anchorlist measures every
mounted row in the DOM and keeps the viewport anchored to a row key. Wrong estimates are
corrected before paint, without visible movement.

## No estimate needed

`estimateSize` is optional. Without it, unmeasured rows start at 48 px, and once rows have been
measured, the measured average is used. The estimate is refreshed at idle whenever the average
drifts by more than 10%.

<!-- react-api:start (assumed React API, see "React API used on this page" below) -->

```tsx
<AnchorList
  items={rows}
  getKey={(row) => row.id}
  renderItem={(row) => <Row row={row} />} // any height, can change at any time
/>
```

Give an estimate only when you know it, for example when item types have very different typical
heights:

```tsx
<AnchorList
  items={rows}
  getKey={(row) => row.id}
  estimateSize={(index) => (rows[index].kind === 'image' ? 320 : 64)}
  renderItem={(row) => <Row row={row} />}
/>
```

`estimateSize` takes an **index**, like the core option.

::: details React API used on this page
These names are not final until `@anchorlist/react` is published:
`AnchorList`, `items`, `getKey(item)`, `renderItem(item)`. `estimateSize(index)` is a
[core option](/api/#options) passed through unchanged.
:::

<!-- react-api:end -->

## What gets measured

- **A row's size is its border box** on the scroll axis, read through a `ResizeObserver`.
- Put spacing inside the row (padding, or a flex column) or use the `gap` option. A `margin` on
  the row element is not part of its border box and would be lost.
- Headers and footers can change size at any time. They are measured too, and the anchor is
  compensated.

## Rows that change height

When a row grows or shrinks (an image loads, text expands, a reply thread opens), it is
re-measured in the same `ResizeObserver` callback and the scroll offset is corrected before paint.
Which edge holds still depends on `align`:

- `align: 'start'` (feeds): the anchored row's **top** edge stays put, and it grows downwards.
- `align: 'end'` (chat): its **bottom** edge stays put, and it grows upwards like a chat bubble.

## Width changes

When the list's width changes, text re-wraps and every height changes. anchorlist marks all
cached sizes as stale, re-measures the mounted rows in the same callback and restores the anchor
before paint. Rows outside the viewport keep their old size as an estimate until they are
rendered again. `getItemRect(key).measured` reports `false` for them.

## Mixed content

Any mix of sizes works in one list: one-line messages, tall images, date separators, system
notices. The engine stores sizes in a Fenwick tree, so offset lookups are O(log n) at any list
length. Prepends, appends and trims cost O(k log n) for k changed items. A streaming update (the
last message grows while tokens arrive) is O(1) in the list size. In the 100k-item
micro-benchmark that update measured p50 9.5–11.6 µs (Apple M2, Node 24, simulated scroller).

## Limits in v0.1

- No border compensation: don't put main-axis borders on the scroll container or the list.
- Window scrolling (`windowScroller`), horizontal RTL, grid and masonry are planned for later
  versions.

## Related

- [React chat virtual list](./chat-virtual-list)
- [Infinite feed](./feed)
- [API reference](/api/)
