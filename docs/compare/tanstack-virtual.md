---
title: TanStack Virtual alternative for chat and anchored lists
description: anchorlist vs TanStack Virtual, an honest feature comparison. Built-in chat (bottom-anchored) lists, prepend without scroll jump, dynamic heights without estimates, bundle size budgets, and when TanStack Virtual is the better choice.
---

# anchorlist vs TanStack Virtual

[TanStack Virtual](https://tanstack.com/virtual) is a mature, headless virtualisation library
with adapters for many frameworks. anchorlist is newer and narrower. It focuses on lists that must
keep their scroll position: chat, reverse infinite scroll and feeds where items are prepended or
change size. This page says where each one fits.

::: info Benchmark
The [chat benchmark](./benchmark) measures both libraries in one harness, with TanStack Virtual's
chat options: drift on prepend and resize, following new messages, re-renders and bundle size.
:::

## Feature comparison

The TanStack Virtual column reflects its public documentation at the time of writing. Corrections
are welcome on [GitHub](https://github.com/saranbalaji1408/anchorlist/issues).

| | anchorlist v0.2 | TanStack Virtual |
| --- | --- | --- |
| Model | Headless core with a React component | Headless (hooks/adapters, you render the DOM) |
| Frameworks | React (Vue and Svelte planned) | React, Vue, Svelte, Solid, Angular, Lit and vanilla |
| Pin to the end (chat, newest at the bottom) | Built in: `align: 'end'` | `anchorTo: 'end'` plus `scrollToIndex(last)` on mount |
| Prepend without scroll jump | Built in, anchored to an item key | With `anchorTo: 'end'`, anchored to an item key |
| Follow new items at the pinned edge | Built in, with a `follow` policy | `followOnAppend` |
| Dynamic / variable heights | Measured from the DOM; estimate optional | Measured via `measureElement`; `estimateSize` required |
| Width change re-measure | Built in, anchor restored before paint | Rows re-measured through `ResizeObserver` |
| Edge triggers (load more) | `onStartReached` / `onEndReached` | Not built in; usually derived from the rendered range |
| iOS momentum-safe corrections | Deferred through a transform | Not documented |
| Restore scroll position | `getSnapshot` / `initialSnapshot` (key-based) | `initialOffset` (pixel-based) |
| Window scrolling | Planned (v0.3) | Yes |
| Horizontal | Core yes (no RTL normalisation yet) | Yes |
| Grid / masonry | Planned (v0.4) | Yes (lanes, or two virtualizers) |
| Sticky items | `StickyItem` (`anchorlist/sticky`) | Yes, via custom range extraction |
| Smooth scroll to an unrendered item | `animateToKey` (`anchorlist/animate`) | `scrollToIndex` with `behavior: 'smooth'` |
| Server rendering | Opt-in: `initialRect` + `initialPlan` | `initialRect` |
| Focused row kept mounted | Built in | Implemented by the app (`rangeExtractor`) |
| Runtime dependencies (core) | 0 | Framework adapter plus `@tanstack/virtual-core` |

## Size

anchorlist enforces gzip size budgets in CI with size-limit:

| Entry | Size (min + gzip) |
| --- | --- |
| `@anchorlist/core` list entry (`createVirtualizer` + `elementScroller`) | ≤ 4.5 kB budget, currently 4.50 kB (4,496 B) |
| `@anchorlist/core` main entry, everything | ≤ 6.5 kB budget, currently 5.67 kB |
| `@anchorlist/react` alone (React and core external) | ≤ 1.3 kB budget, currently 1.19 kB |
| React chat path (core + react) | ≤ 5.8 kB budget, currently 5.63 kB |

Sticky items, smooth scrolling, snapshot sizes and server rendering are separate entries, so a
list that doesn't use them doesn't load them.

The budgets are hard limits: CI fails if an entry grows past its budget.

Measured with the same tool and settings in the [benchmark](./benchmark#bundle-size),
`{ AnchorList }` is 5,521 B and TanStack Virtual's `{ useVirtualizer }` 7,588 B (React external).

## When to choose anchorlist

- Chat or messaging UIs, AI chat with streaming responses, comment threads, logs that load older
  entries upwards.
- Feeds where new items are inserted above the reader and must not push content down.
- Lists whose rows change height after render (images, embeds, expanding text), where you'd
  rather not write scroll-compensation code yourself.

## When to choose TanStack Virtual

- You need Vue, Svelte, Solid, Angular or Lit today.
- You need grids, masonry or window scrolling today.
- You want full control over rendering and are happy to build anchoring yourself.

## Migrating

The concepts map closely: both use `count`, `getKey`, `estimateSize`, `overscan`, `gap` and
`paddingStart` / `paddingEnd`. The main differences:

- Keys are **required** and drive anchoring, so they must be stable.
- You never set `scrollTop` or apply offset compensation. Remove that code and use
  `scrollToKey` / `scrollToEdge`.
- For chat, set `align: 'end'` instead of reversing the list or using `flex-direction:
  column-reverse`.

See [Getting started](/guide/getting-started) and the [API reference](/api/).
