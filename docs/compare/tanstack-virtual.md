---
title: TanStack Virtual alternative for chat and anchored lists
description: anchorlist vs TanStack Virtual, an honest feature comparison. Built-in chat (bottom-anchored) lists, prepend without scroll jump, dynamic heights without estimates, bundle size budgets, and when TanStack Virtual is the better choice.
---

# anchorlist vs TanStack Virtual

[TanStack Virtual](https://tanstack.com/virtual) is a mature, headless virtualisation library
with adapters for many frameworks. anchorlist is newer and narrower. It focuses on lists that must
keep their scroll position: chat, reverse infinite scroll and feeds where items are prepended or
change size. This page says where each one fits.

::: info Benchmarks
This page compares features only. A head-to-head benchmark (scroll stability, frame cost, bundle
size measured in one harness) is planned for **v0.2**. Until then, the only numbers here are
anchorlist's own.
:::

## Feature comparison

The TanStack Virtual column reflects its public documentation at the time of writing. Corrections
are welcome on [GitHub](https://github.com/saranbalaji1408/anchorlist/issues).

| | anchorlist v0.1 | TanStack Virtual |
| --- | --- | --- |
| Model | Headless core with a React component | Headless (hooks/adapters, you render the DOM) |
| Frameworks | React (Vue and Svelte planned) | React, Vue, Svelte, Solid, Angular, Lit and vanilla |
| Pin to the end (chat, newest at the bottom) | Built in: `align: 'end'` | Not built in; implemented by the app |
| Prepend without scroll jump | Built in, anchored to an item key | Not built in; the app adjusts the offset |
| Follow new items at the pinned edge | Built in, with a `follow` policy | Not built in |
| Dynamic / variable heights | Measured from the DOM; estimate optional | Measured via `measureElement`; `estimateSize` required |
| Width change re-measure | Built in, anchor restored before paint | Rows re-measured through `ResizeObserver` |
| Edge triggers (load more) | `onStartReached` / `onEndReached` | Not built in; usually derived from the rendered range |
| iOS momentum-safe corrections | Deferred through a transform | Not documented |
| Restore scroll position | `getSnapshot` / `initialSnapshot` (key-based) | `initialOffset` (pixel-based) |
| Window scrolling | Planned (v0.3) | Yes |
| Horizontal | Core yes (no RTL normalisation yet) | Yes |
| Grid / masonry | Planned (v0.4) | Yes (lanes, or two virtualizers) |
| Sticky items | Planned (v0.2) | Yes, via custom range extraction |
| Runtime dependencies (core) | 0 | Framework adapter plus `@tanstack/virtual-core` |

## Size

anchorlist enforces gzip size budgets in CI with size-limit:

| Entry | Size (min + gzip) |
| --- | --- |
| `@anchorlist/core` list entry (`createVirtualizer` + `elementScroller`) | ≤ 4.5 kB budget, currently 4.49 kB |
| `@anchorlist/core` everything | ≤ 6.5 kB budget, currently 5.54 kB |
| `@anchorlist/react` alone (React and core external) | ≤ 1.3 kB budget, currently 1.01 kB |
| React chat path (core + react) | ≤ 5.8 kB budget, currently 5.35 kB |

The budgets are hard limits: CI fails if an entry grows past its budget.

A size comparison against TanStack Virtual, measured with the same tool and settings, will be
published with the v0.2 benchmark.

## When to choose anchorlist

- Chat or messaging UIs, AI chat with streaming responses, comment threads, logs that load older
  entries upwards.
- Feeds where new items are inserted above the reader and must not push content down.
- Lists whose rows change height after render (images, embeds, expanding text), where you'd
  rather not write scroll-compensation code yourself.

## When to choose TanStack Virtual

- You need Vue, Svelte, Solid, Angular or Lit today.
- You need grids, masonry, window scrolling or sticky rows today.
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
