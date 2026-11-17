---
title: React virtual list with sticky group headers
description: Add sticky section headers (dates, letters, groups) to a virtualized React list. The current header sticks to the top and the next one pushes it out, even when the header row itself is no longer rendered.
---

# Sticky group headers

Grouped lists show the current group at the top of the viewport: a date in a chat, a letter in a
contact list, a section in a settings page. When the next group's header arrives, it pushes the
stuck one out.

In a virtual list a header row can't simply be `position: sticky`. Rows are measured where they
are painted, and the header's row is unmounted once it scrolls far enough away. anchorlist keeps
every row in normal flow and shows a **copy** of the current header in an overlay instead.

## React

```tsx
import { AnchorList } from 'anchorlist'
import { StickyItem } from 'anchorlist/sticky'
// or: import { StickyItem } from '@anchorlist/react/sticky'

// Module scope: stable functions.
const isHeader = (row) => row.type === 'header'
const renderRow = (row) => (row.type === 'header' ? <GroupHeader title={row.title} /> : <Contact contact={row.contact} />)

export function Contacts({ rows }) {
  return (
    <AnchorList
      style={{ height: '100vh' }}
      items={rows}
      getKey={(row) => row.id}
      renderItem={renderRow}
      sticky={(range) => <StickyItem range={range} items={rows} isSticky={isHeader} renderItem={renderRow} />}
    />
  )
}
```

Headers are ordinary items in `items`, so the data is one flat array: header, rows of that group,
next header, and so on.

- `StickyItem` shows the last header the reader has scrolled past, at the top of the viewport.
- As the next header reaches the top, it pushes the copy out, then takes its place.
- If the reader has scrolled so far that the header's own row is no longer rendered, the copy
  still shows it.
- While the first header is still below the top of the viewport, nothing is shown.
- Give the header component a background, so the rows don't show through the copy.

Keep `isHeader` stable (module scope or `useCallback`). The search for the previous header is
remembered per function, so scrolling only looks at the rows that were newly passed.

## Accessibility and clicks

The copy is `aria-hidden` and `inert`: screen readers read each header once, in its row, and
keyboard focus never lands in the copy. Clicks on the copy go to whatever is underneath it. If
your headers need to be clickable (to collapse a group, for example), handle that in the header
rows themselves.

## Without React

`stickyState` from `@anchorlist/core/sticky` computes which item is stuck and how far the next one
pushes it. Call it on every `scroll` event and after every commit, and render a copy of item
`index` shifted by `offset`:

```ts
import { stickyState } from '@anchorlist/core/sticky'

const { index, offset } = stickyState(scrollerElement, v.getVisibleRange(), (i) => isHeader(items[i]), copyHeight)
```

`index` is -1 when nothing is stuck. `offset` is 0 or negative. The copy must not carry a
`data-index` attribute: rows are found by the one the engine writes.

## Limits

Sticky items need a vertical list with its own scroll container (the default `elementScroller`).
`windowScroller`, horizontal lists and right-to-left lists are not supported yet: `stickyState`
measures rows against the scroll container's top edge. The overlay is an extra element in the scroll container,
not part of the list, so it does not affect measurements or anchoring.

## Size

`@anchorlist/core/sticky` is 423 B gzip (budget 500 B) and `@anchorlist/react/sticky`, core part
included, 794 B (budget 800 B). Lists without sticky headers don't load either.

## How it is tested

End-to-end scenarios in Chromium, WebKit and Firefox, with React 18 and 19: the current header
sticks over the rows without moving them, the next header pushes it out and replaces it, a header
whose row is no longer mounted stays stuck, nothing is shown above the first header, and anchoring
holds through a prepend while a header is stuck.

## Related

- [React chat virtual list](./chat-virtual-list) (a sticky date pill from the visible range)
- [Accessibility and focus](./accessibility)
- [API reference: sticky items](/api/#sticky-items)
