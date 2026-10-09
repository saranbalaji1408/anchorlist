# anchorlist: virtual list for React with stable scroll anchoring

**anchorlist** is a small virtual list (virtualized list / windowing library) for React. It is
built for chat lists and reverse infinite scroll without scroll jump, infinite feeds and dynamic
item heights. Pin a list to its end (chat) or its start (feed), with any mix of row sizes.

- Documentation: https://saranbalaji1408.github.io/anchorlist/
- npm: [`anchorlist`](packages/anchorlist), with the full feature list and examples
- Issues: https://github.com/saranbalaji1408/anchorlist/issues

```sh
npm install anchorlist
```

<!-- react-api:start (assumed React API; reconcile with @anchorlist/react) -->

```tsx
import { AnchorList } from 'anchorlist'

<AnchorList
  style={{ height: 600 }}
  items={messages}
  getKey={(m) => m.id}
  align="end"
  hasMoreStart={hasOlder}
  onStartReached={loadOlder}
  renderItem={(m) => <Message message={m} />}
/>
```

<!-- react-api:end -->

## Why anchorlist

- **Stable scroll anchoring:** prepend history, append messages, remove items and resize rows
  without the viewport jumping. The core's fuzz test checks this to within 0.5 px over 1.2M random
  operations.
- **Chat and feeds from one option:** `align: 'end'` stays pinned to the newest item, and
  `'start'` serves top-anchored feeds.
- **Dynamic heights:** rows are measured as they render, so no fixed row height or estimate is
  required.
- **Small:** hard gzip budgets enforced in CI (core list entry 4.5 kB, React chat path 5.8 kB).

## Packages

| Package | Description |
| --- | --- |
| [`anchorlist`](packages/anchorlist) | Re-exports core and React bindings |
| [`@anchorlist/core`](packages/core) | Framework-agnostic engine, zero dependencies ([API](packages/core/API.md), [design](packages/core/DESIGN.md)) |
| [`@anchorlist/react`](packages/react) | React 18 / 19 bindings |

Vue and Svelte bindings are planned.

## Comparisons

- [anchorlist vs TanStack Virtual](https://saranbalaji1408.github.io/anchorlist/compare/tanstack-virtual)
- [anchorlist vs react-virtuoso](https://saranbalaji1408.github.io/anchorlist/compare/react-virtuoso)

Head-to-head benchmarks are planned for v0.2.

## Development

See [AGENTS.md](AGENTS.md) for build, test and contribution conventions.

```sh
pnpm install
pnpm build && pnpm test
```

## Licence

TODO(licence): licence to be decided before the first public release.
