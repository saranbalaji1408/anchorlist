---
title: React virtual list benchmark for chat (anchorlist vs TanStack Virtual vs react-virtuoso)
description: "A head-to-head benchmark of React virtual lists in a chat: scroll drift on prepend and resize, re-renders per prepend, following new messages, and bundle size. Pinned versions, each library configured per its own docs, methodology and raw JSON included."
---

# Benchmark: chat lists in React

The same chat list built three ways, driven through the same scenarios in Chromium, Firefox and
WebKit:

| Library | Version | Configured as its documentation shows |
| --- | --- | --- |
| anchorlist | v0.2 | `<AnchorList align="end">` |
| `@tanstack/react-virtual` | 3.14.14 | `useVirtualizer` with `measureElement` and `getItemKey`, plus its chat options `anchorTo: 'end'` and `followOnAppend: true` |
| `react-virtuoso` | 4.18.16 | `<Virtuoso>` with `firstItemIndex`, `initialTopMostItemIndex`, `followOutput="auto"`, `alignToBottom` and `computeItemKey` |

`VirtuosoMessageList` is a commercial product with a different licence and is not included.

The list holds 10,000 messages from 40 to 160 px tall in a 420 × 600 px container. Every library
that takes a size estimate gets 100 px, so the estimate is wrong for almost every row, as in a
real chat. Each scenario runs 3 times per browser; the tables show the worst run. The harness, the
raw results and the full methodology are in the repository's
[`bench/`](https://github.com/saranbalaji1408/anchorlist/tree/main/bench) directory.

## Results

### The message being read stays still

Drift is how far a message in the viewport moves, sampled once per painted frame after each
library's own corrections.

| Scenario | anchorlist | TanStack Virtual | react-virtuoso |
| --- | --- | --- | --- |
| Prepend 10 × 50 unmeasured messages while reading history | 0 px | 0 px | 0 px |
| A message above the viewport grows by 80 px, 5 times | 0 px | 0 px in Chromium and WebKit, 160 px in Firefox | n/a¹ |

¹ With its default settings react-virtuoso keeps no row mounted above the viewport, so there is no
mounted row to grow. Rows it mounts later are measured as they appear.

All three keep the reader in place on prepend. TanStack Virtual gained this with `anchorTo:
'end'` in its 3.x line; the [comparison page](./tanstack-virtual) reflects it.

### Following new messages

Pinned at the bottom, 20 messages are appended, either 3 frames apart (a fast stream) or 10
frames apart. "Lost" counts appends after which the list was more than 1 px from the bottom.

| Appends | anchorlist | TanStack Virtual | react-virtuoso |
| --- | --- | --- | --- |
| 3 frames apart | 0 lost | up to 1 lost (133 px) | up to 18 lost (1,026 px) |
| 10 frames apart | 0 lost | 0 lost | up to 19 lost (1,754 px) |

With its default 4 px `atBottomThreshold`, react-virtuoso can land short of the bottom when a new
message's real height differs from its estimate, and then stops following. A larger
`atBottomThreshold` reduces this; the benchmark doesn't tune any library.

### Re-renders per prepend

How many already-mounted messages re-render when 50 older messages are prepended:

| Row content | anchorlist | TanStack Virtual | react-virtuoso |
| --- | --- | --- | --- |
| A plain component | 0 | 11 | 14 |
| Wrapped in `React.memo` | 0 | 0 | 0 (up to 3 in WebKit) |

anchorlist never passes the index to a row, so a prepend doesn't touch mounted rows even without
`React.memo`. With `memo`, the others skip them too.

### Bundle size

Minified and gzipped with size-limit, React and React DOM external, importing what each
configuration uses:

| Import | Size |
| --- | --- |
| `{ AnchorList }` from `anchorlist` (core included) | 5,521 B |
| `{ useVirtualizer }` from `@tanstack/react-virtual` | 7,588 B |
| `{ Virtuoso }` from `react-virtuoso` | 19,093 B |

## What is not measured here

- **Timings** (time to settle, update cost, main-thread time per scrolled frame) are recorded in
  the results file, but this run shared the machine with other work, so they are not published
  here. They will be published from a run on a quiet machine.
- Touch scrolling and iOS momentum, where anchorlist defers corrections, are not covered: the
  browsers run headless on a desktop.
- Each library is used as its documentation shows. Options such as a larger overscan,
  `increaseViewportBy` or `atBottomThreshold` change some results.

## Methodology

- A production build (Vite, React 19) served locally; a fresh page for every run; Playwright
  drives the browsers at a 1000 × 800 viewport.
- The same item data for every library (seeded), and the same row component.
- Updates are applied with `flushSync`, so each one is committed before the runner continues.
- **Drift** is sampled once per painted frame, after every list's pre-paint corrections: a probe
  element is resized from `requestAnimationFrame` and the sample is taken in the probe's
  `ResizeObserver` callback, which runs after the libraries' own observers. Sampling directly in
  `requestAnimationFrame` would count corrections that never reach the screen as drift.
- The anchor is the first message starting at least 200 px below the top of the viewport.

Run it yourself with `pnpm bench`. Results go to `bench/results/results.json`, with the medians,
the worst run, every raw run, the browser versions and the commit.

## Related

- [anchorlist vs TanStack Virtual](./tanstack-virtual)
- [anchorlist vs react-virtuoso](./react-virtuoso)
- [React chat virtual list](/guide/chat-virtual-list)
