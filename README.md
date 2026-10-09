# anchorlist: virtual list with stable scroll anchoring for React, Vue and Svelte

**anchorlist** is a tiny, zero-dependency virtual list (virtualized list / windowing library) with
stable scroll anchoring, built for chat lists without scroll jump, reverse infinite scroll,
infinite feeds, dynamic item heights, masonry and grid layouts.

> **Status: pre-release.** Nothing is published yet. The first usable version is planned as v0.1.

- Documentation: https://saranbalaji1408.github.io/anchorlist/
- React chat virtual list guide: https://saranbalaji1408.github.io/anchorlist/guide/chat-virtual-list
- Issues: https://github.com/saranbalaji1408/anchorlist/issues

## Why anchorlist

- **Stable scroll anchoring**: prepend history, append messages and resize items without the viewport jumping.
- **Chat and reverse infinite scroll**: bottom-anchored lists that stay pinned to the newest item.
- **Dynamic heights**: items are measured as they render; no fixed row height required.
- **Small**: size budgets are enforced in CI (core list entry at most 4.5 kB gzip).

## Packages

| Package | Description |
| --- | --- |
| [`anchorlist`](packages/anchorlist) | Convenience package re-exporting core and React bindings |
| [`@anchorlist/core`](packages/core) | Framework-agnostic engine, zero dependencies |
| [`@anchorlist/react`](packages/react) | React 18 / 19 bindings |

Vue and Svelte bindings are planned.

## Development

See [AGENTS.md](AGENTS.md) for build, test and contribution conventions.

```sh
pnpm install
pnpm build && pnpm test
```

## Licence

TODO(licence): licence to be decided before the first public release.
