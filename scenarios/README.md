# scenarios

Framework-neutral end-to-end scenarios for anchorlist. Each scenario describes user-visible
behaviour (for example "prepending older messages keeps the visible message in place") and is run by
Playwright against the framework fixtures in `fixtures/*` on Chromium, WebKit and Firefox.

## Driver

Scenarios never touch framework code. Each fixture exposes `window.__driver`, which implements the
`Driver` interface in [`src/driver.ts`](./src/driver.ts):

- list operations: `mount(config)`, `update(patch, 'sync' | 'transition')`, `setItemHeight`, `unmount`;
- the list handle: `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`, ...;
- recorded callbacks and row render counts: `events()`, `renders()`, `rendersWithoutScroller()`;
- DOM probes shared by every fixture ([`src/dom.ts`](./src/dom.ts)): row rects, `rowAt`, user-like
  `scrollBy`, and a frame sampler that records values once per painted frame, after every pre-paint
  correction.

A fixture must render the scroll container with `id="scroller"`, rows with `data-key`, and the sticky
overlay content as `[data-testid="pill"]`. It must intern items by id so unchanged items keep their
identity across `update` calls.

## Layout

- `src/` - Driver interface, DOM probes, data generators and the Playwright harness (`test`, `still`,
  drift recording to `test-results/drift.jsonl`).
- `tests/` - Playwright specs. Drift assertions use a 0.5 px tolerance.

The fixture is built in development mode, so React StrictMode double-invokes renders and effects, and
any console error or warning fails the scenario.
