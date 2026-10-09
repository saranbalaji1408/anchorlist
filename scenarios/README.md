# scenarios

Framework-neutral end-to-end scenarios for anchorlist. Each scenario describes user-visible
behaviour (for example "prepending older messages keeps the visible message in place") and is
run by Playwright against every framework fixture in `fixtures/*` across Chromium, WebKit and Firefox.

## Driver interface (to come)

Scenarios never touch framework code directly. Each fixture exposes a `window.__driver` object
that implements a shared `Driver` interface (append, prepend, resize item, scroll to index,
read anchor position, and so on). The interface will be defined here before the first
virtualisation scenario lands; fixtures currently expose an empty object.

## Layout

- `tests/` - Playwright specs (currently a smoke test that loads the React fixture).
- `smoke/` - placeholder for shared scenario definitions.
