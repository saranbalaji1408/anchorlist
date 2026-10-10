# @anchorlist/svelte

Svelte 5 bindings for [`@anchorlist/core`](https://www.npmjs.com/package/@anchorlist/core): a virtual list that keeps the row being read
in place while items are prepended, appended, trimmed, removed or resized. About 1.6 kB gzip on top
of the core (compiled).

Start with the [`anchorlist`](https://www.npmjs.com/package/anchorlist) landing page for an overview.
Full documentation: https://saranbalaji1408.github.io/anchorlist/

```svelte
<script lang="ts">
  import { AnchorList } from '@anchorlist/svelte'
</script>

<!-- align="end" for chat: pinned to the bottom; the default 'start' suits feeds -->
<AnchorList
  style="height: 600px"
  items={messages}
  getKey={(m) => m.id}
  align="end"
  hasMoreStart={hasOlder}
  onStartReached={loadOlder}
>
  {#snippet children(message)}
    <Bubble {message} />
  {/snippet}
</AnchorList>
```

- **Props:** `items`, `getKey(item)`, `rowClass`, plus every core option (`align`, `gap`, `overscan`,
  `follow`, `hasMoreStart`, `onEndReached`, `initialSnapshot`, ...). Other attributes (`class`,
  `style`, `id`, `aria-label`, event handlers) go to the scroll container.
- **Snippets:** `children(item)`, `header`, `footer`, and `sticky(range)` (renders from the visible
  range).
- **`bind:this`:** `scrollToKey`, `scrollToIndex`, `scrollToEdge`, `isAtEdge`, `getSnapshot`,
  `getVisibleRange`, `getItemRect`, `getTotalSize`, `indexOf`, `subscribe`.
- **Rows get no index**, so a prepend updates no mounted row. A row updates when its item changes or
  when state read in the snippet changes. Keep items immutable (`$state.raw` or new objects).
- **Headless:** `createAnchorList(options, elements)` returns `{ virtualizer, plan }` for custom
  markup; render rows `plan.start..plan.end` as the only children of the list.
- Requires Svelte 5 (runes).
