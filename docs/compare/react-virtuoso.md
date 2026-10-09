---
title: react-virtuoso alternative for chat and infinite feeds
description: anchorlist vs react-virtuoso, an honest feature comparison for React chat lists, reverse infinite scroll, prepending without scroll jump, dynamic heights and bundle size budgets.
---

# anchorlist vs react-virtuoso

[react-virtuoso](https://virtuoso.dev) is a feature-rich React virtualisation library with
components for lists, grouped lists, grids and tables. It measures item heights automatically and
supports chat-style lists. anchorlist covers a narrower set of use cases with a small,
framework-agnostic core. The anchoring model and the size budgets are the main differences.

::: info Benchmarks
This page compares features only. A head-to-head benchmark (scroll stability, frame cost, bundle
size measured in one harness) is planned for **v0.2**. Until then, the only numbers here are
anchorlist's own.
:::

## Feature comparison

The react-virtuoso column reflects its public documentation at the time of writing. Corrections
are welcome on [GitHub](https://github.com/saranbalaji1408/anchorlist/issues).

| | anchorlist v0.1 | react-virtuoso |
| --- | --- | --- |
| Model | Framework-agnostic core and a thin React component | React components |
| Frameworks | React (Vue and Svelte planned) | React |
| Dynamic heights | Measured from the DOM; estimate optional | Measured automatically |
| Chat (start at the bottom) | `align: 'end'` | `initialTopMostItemIndex` / `alignToBottom` |
| Follow new messages | `follow` (boolean or pure function) | `followOutput` |
| Prepend history | Detected from keys; no index bookkeeping | `firstItemIndex`, decremented by the app on prepend |
| Load more | `onStartReached` / `onEndReached` with `hasMoreStart` / `hasMoreEnd` | `startReached` / `endReached` |
| Width change re-measure | Built in, anchor restored before paint | Built in |
| iOS momentum-safe corrections | Deferred through a transform | Not documented |
| Restore scroll position | `getSnapshot` / `initialSnapshot` | `getState` / `restoreStateFrom` |
| Grouped lists, sticky headers | Planned (v0.2) | Yes (`GroupedVirtuoso`) |
| Tables | Not planned yet | Yes (`TableVirtuoso`) |
| Grid | Planned (v0.4) | Yes (`VirtuosoGrid`) |
| Window scrolling | Planned (v0.3) | Yes (`useWindowScroll`) |
| SSR | Planned (v0.2) | Yes (`initialItemCount`) |

## Size

anchorlist enforces gzip size budgets in CI with size-limit:

| Entry | Budget | Measured |
| --- | --- | --- |
| `@anchorlist/core` list entry (`createVirtualizer` + `elementScroller`) | 4.5 kB | 4,494 B |
| `@anchorlist/core` everything | 6.5 kB | 5,537 B |
| `@anchorlist/react` alone | 1.3 kB | |
| React chat path (core + react) | 5.8 kB | |

A size comparison against react-virtuoso, measured with the same tool and settings, will be
published with the v0.2 benchmark.

## When to choose anchorlist

- You want a chat list where prepending history needs no `firstItemIndex` bookkeeping: pass the
  new array and the reader stays in place.
- You remove or replace messages near the viewport (deletions, edits, de-duplication) and need
  the viewport to stay put even when the anchored message itself goes away.
- Bundle size matters: the React chat path has a hard 5.8 kB gzip budget.
- You plan to share one engine across React, Vue and Svelte.

## When to choose react-virtuoso

- You need grouped lists with sticky headers, tables, grids, window scrolling or SSR today.
- You want a mature, widely used library with a long track record.

## Migrating

| react-virtuoso | anchorlist |
| --- | --- |
| `data` + `itemContent` | `items` + `renderItem` (React API being finalised) |
| `computeItemKey` | `getKey` (required) |
| `firstItemIndex` | Not needed; prepend by passing a new array |
| `initialTopMostItemIndex={last}` | `align="end"` |
| `followOutput` | `follow` |
| `startReached` / `endReached` | `onStartReached` / `onEndReached` plus `hasMoreStart` / `hasMoreEnd` |
| `atBottomStateChange` | `onAtEdgeChange` |
| `scrollToIndex` | `scrollToKey` / `scrollToIndex` / `scrollToEdge` |
| `components.Header` / `Footer` | `header` / `footer` (React API being finalised) |

See [React chat virtual list](/guide/chat-virtual-list) and the [API reference](/api/).
