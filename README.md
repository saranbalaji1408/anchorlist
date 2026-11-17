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

```tsx
import { AnchorList } from 'anchorlist'

const renderMessage = (m) => <Message message={m} /> // stable: module scope or useCallback

<AnchorList
  style={{ height: 600 }}
  items={messages}
  getKey={(m) => m.id}
  align="end"
  hasMoreStart={hasOlder}
  onStartReached={loadOlder}
  renderItem={renderMessage}
/>
```

## Why anchorlist

- **Stable scroll anchoring:** prepend history, append messages, remove items and resize rows
  without the viewport jumping. At DPR 1 each painted change moves content by at most 0.5 px for whole-pixel rows (at most 1 px
  with fractional heights once the error has passed 0.5 px), and content is never more than 1 px
  from its intended position, checked by a seeded fuzz test.
- **Chat and feeds from one option:** `align: 'end'` stays pinned to the newest item, and
  `'start'` serves top-anchored feeds.
- **Dynamic heights:** rows are measured as they render, so no fixed row height or estimate is
  required.
- **Production features as opt-in entries:** sticky group headers, smooth scrolling to unrendered
  items, snapshot sizes and server rendering, plus focus preservation and `aria-busy` built in.
- **Any scroller, any axis:** a list can scroll with the page (`anchorlist/window`), horizontally
  (`anchorlist/horizontal`) or right-to-left (`anchorlist/rtl`), and items can be laid out in a grid or
  masonry (`anchorlist/lanes`). These are opt-in entries, so a plain list does not pay for them.
- **Small:** hard gzip budgets enforced in CI. The React chat path (core + react) must stay at or below 5.8 kB and is currently 5.73 kB.

## Packages

| Package | Description |
| --- | --- |
| [`anchorlist`](packages/anchorlist) | Re-exports core and React bindings |
| [`@anchorlist/core`](packages/core) | Framework-agnostic engine, zero dependencies ([API](packages/core/API.md), [design](packages/core/DESIGN.md)) |
| [`@anchorlist/react`](packages/react) | React 18 / 19 bindings |
| [`@anchorlist/vue`](packages/vue) | Vue 3 bindings |
| [`@anchorlist/svelte`](packages/svelte) | Svelte 5 bindings |

## Comparisons

- [anchorlist vs TanStack Virtual](https://saranbalaji1408.github.io/anchorlist/compare/tanstack-virtual)
- [anchorlist vs react-virtuoso](https://saranbalaji1408.github.io/anchorlist/compare/react-virtuoso)

- [Chat benchmark](https://saranbalaji1408.github.io/anchorlist/compare/benchmark): drift, following, re-renders and bundle size against both, in one harness ([`bench/`](bench)).

## Development

See [AGENTS.md](AGENTS.md) for build, test and contribution conventions.

```sh
pnpm install
pnpm build && pnpm test
```

## Licence

[MIT](https://github.com/saranbalaji1408/anchorlist/blob/main/LICENSE)
