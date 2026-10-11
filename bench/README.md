# bench

Head-to-head benchmark of three React virtual lists in the same chat list:

| Library | Version | Configuration (each per its own documentation) |
| --- | --- | --- |
| `anchorlist` | this repository | `<AnchorList align="end">` |
| `@tanstack/react-virtual` | 3.14.14 (pinned) | `useVirtualizer` with the dynamic-size pattern (`measureElement`, `getItemKey`) and its chat options `anchorTo: 'end'` and `followOnAppend: true`; opened at the end with `scrollToIndex(last, { align: 'end' })` |
| `react-virtuoso` | 4.18.16 (pinned) | `<Virtuoso>` with `firstItemIndex` (decreased by the number of prepended items), `initialTopMostItemIndex={last}`, `followOutput="auto"`, `alignToBottom` and `computeItemKey` |

`VirtuosoMessageList` is not included: it is a commercial product with a different licence.

```sh
pnpm bench                          # builds the packages and the bench app, then runs everything
RUNS=5 node run.ts                  # from bench/, after a build: more runs per scenario (default 3)
BROWSERS=chromium node run.ts       # a subset of chromium, firefox, webkit
pnpm --filter @anchorlist/bench size  # bundle sizes only
```

The output is `results/results.json`.

## Setup

- A production build of `src/` (Vite, React 19), served locally. Each run loads a fresh page.
- One scroll container, 420 × 600 px, holding 10,000 items. Rows are 40 to 160 px tall (seeded
  random, the same items for every library). Every library that takes a size estimate gets 100 px, so
  estimates are wrong for almost every row, as they are in a real chat.
- The row content is the same component for every library. By default it is not memoised, so it
  re-renders exactly when its list re-renders it. The `prependMemo` scenario repeats the prepend
  with `React.memo` on the row content.
- State updates are applied with `flushSync` from the runner, so each one is committed before the
  runner continues. Rows grow by replacing the item with a taller copy (same id).
- Playwright drives Chromium, Firefox and WebKit headless at a 1000 × 800 viewport.

## Measuring position

Drift is the movement of an anchor row (the first row starting at least 200 px below the viewport
top) relative to the scroll container, in px. It is sampled **once per painted frame**, after every
list's pre-paint corrections: a probe element is resized from `requestAnimationFrame`, and the
sample is read in that probe's `ResizeObserver` callback. Observers run in creation order and the
probe's is created last, so a library that corrects positions in its own `ResizeObserver` callback
is measured after its correction. Sampling directly in `requestAnimationFrame` would count those
corrections as drift.

- `driftMax` and `driftP95`: the largest and 95th-percentile absolute displacement over all painted
  frames of a scenario.
- `lostFrames`: painted frames in which the anchor row was not mounted at all.
- `finalOffset`: displacement after the scenario settled.

## Scenarios

| Scenario | What happens | Metrics |
| --- | --- | --- |
| `prepend` | Mount at the bottom, scroll 3000 px up, then prepend 10 pages of 50 unmeasured items, 5 frames apart. | `settleMs` (mount until the newest item is shown at the bottom for 3 frames), drift, `updateMsP50` / `updateMsMax` (time of the synchronous update: render, commit, layout effects and a forced layout), `rerendersPerPrepend` (renders of row content that was already mounted, per prepend, including the 5 frames after it) |
| `prependMemo` | `prepend` with `React.memo` row content. | `rerendersPerPrepend` |
| `growAbove` | Scrolled 3000 px up, the last mounted row entirely above the viewport grows by 80 px, 5 times, 5 frames apart (an image loading above the reader). `null` when the library keeps no row above the viewport mounted with its default overscan. | drift |
| `followFast` / `followSlow` | Pinned at the bottom, 20 single-item appends 3 or 10 frames apart. Read just before the next append. | `fromBottomMax` (px from the bottom of the scroll range), `unpinnedAppends` (appends after which the list was more than 1 px from the bottom) |
| `scroll` | Chromium only: scroll up 120 px per frame (a fast flick) for 300 frames through unmeasured rows. | `taskMsPerFrame`, `scriptMsPerFrame`, `layoutMsPerFrame` (main-thread time from the DevTools protocol's Performance metrics, over the whole run, per frame; work in any task counts), `frameMsP95` and `longFrames` (intervals between animation frames over 25 ms) |

Bundle sizes come from size-limit (the repository's own tool) with `.size-limit.json`: the minified
and gzipped bytes of the import each configuration uses (`{ AnchorList }`, `{ useVirtualizer }`,
`{ Virtuoso }`), with `react` and `react-dom` external.

## Reading results.json

For every browser, scenario and library, `median` is the median of each metric over the runs,
`worst` is the maximum, and `runs` holds the raw values. `versions.anchorlist` is the commit the
packages were built from, marked when the working tree had uncommitted package changes; publish
numbers only from a clean tree. The machine's CPU and its load averages before and after the run are recorded: timings are only
comparable within one results file, and only meaningful when the load stayed low.

## Limits

- Headless browsers on one machine. Frame intervals are capped by the browser's frame rate, so
  they only show long frames; the main-thread metrics show the work below 16.7 ms.
- Drift is measured in the browser's layout, not on a device screen. Touch scrolling and momentum
  (where anchorlist defers corrections on iOS) are not covered.
- Each library is used as its documentation shows. Other options (for example a larger
  `overscan`, `increaseViewportBy` or `atBottomThreshold`) change some results; they are not tuned
  here.
