<!--
  @component
  Virtual list with stable scroll anchoring. It renders only the rows near the
  viewport and keeps the row being read in place while items are prepended,
  appended, trimmed, removed or resized.

  - `align="end"` pins the list to the bottom (chat: it opens at the newest
    item and follows appends while pinned).
  - `align="start"` (default) pins it to the top (feeds).

  The scroll container needs a fixed size (`style="height: 600px"`). Rows are
  rendered in a flex column; `data-index`, `aria-posinset` and `aria-setsize`
  are written by the engine, and each row has `data-key`. Rows never mount in
  the same update as the scroll container.

  ```svelte
  <AnchorList style="height: 600px" items={messages} getKey={(m) => m.id} align="end"
    hasMoreStart={hasOlder} onStartReached={loadOlder}>
    {#snippet children(message)}<Bubble {message} />{/snippet}
  </AnchorList>
  ```
-->
<script lang="ts" module>
  // Core options: everything else goes to the scroll container.
  const OPTIONS = new Set(
    'estimateSize align overscan gap paddingStart paddingEnd hasMoreStart hasMoreEnd startThreshold endThreshold onStartReached onEndReached atEdgeThreshold follow onRangeChange onAtEdgeChange initialSnapshot maxCachedSizes'.split(
      ' ',
    ),
  )
</script>

<script lang="ts" generics="T">
  import type { VirtualizerOptions, VisibleRange } from '@anchorlist/core'
  import { createAnchorList } from './createAnchorList.svelte.js'
  import type { AnchorListHandle, AnchorListProps } from './types.js'

  const { items, getKey, children, header, footer, sticky, rowClass, ...rest }: AnchorListProps<T> = $props()

  let element: HTMLElement | undefined = $state()
  let content: HTMLElement | undefined = $state()
  let list: HTMLElement | undefined = $state()

  const al = createAnchorList(
    () => {
      // A snapshot: the engine calls getKey for the list as it was when planned.
      const all = items
      const key = getKey
      // Undefined options mean their defaults in the core.
      return { ...rest, count: all.length, getKey: (i: number) => key(all[i]!) } as VirtualizerOptions
    },
    () => element && list && content && { element, list, content },
  )
  const v = al.virtualizer
  const rows = $derived(items.slice(al.plan.start, al.plan.end + 1))
  const attrs = $derived(Object.fromEntries(Object.entries(rest).filter(([k]) => !OPTIONS.has(k))))

  let range: VisibleRange = $state.raw(v.getVisibleRange())
  $effect(() => v.subscribe(() => (range = v.getVisibleRange())))

  export const scrollToKey: AnchorListHandle['scrollToKey'] = v.scrollToKey
  export const scrollToIndex: AnchorListHandle['scrollToIndex'] = v.scrollToIndex
  export const scrollToEdge: AnchorListHandle['scrollToEdge'] = v.scrollToEdge
  export const isAtEdge: AnchorListHandle['isAtEdge'] = v.isAtEdge
  export const getSnapshot: AnchorListHandle['getSnapshot'] = v.getSnapshot
  export const getVisibleRange: AnchorListHandle['getVisibleRange'] = v.getVisibleRange
  export const getItemRect: AnchorListHandle['getItemRect'] = v.getItemRect
  export const getTotalSize: AnchorListHandle['getTotalSize'] = v.getTotalSize
  export const indexOf: AnchorListHandle['indexOf'] = v.indexOf
  export const subscribe: AnchorListHandle['subscribe'] = v.subscribe
</script>

<div {...attrs} bind:this={element} style:overflow-y="auto" style:overflow-anchor="none">
  {#if sticky}
    <div style="position: sticky; top: 0; height: 0; z-index: 1">{@render sticky(range)}</div>
  {/if}
  <div bind:this={content}>
    {@render header?.()}
    <div
      bind:this={list}
      role="list"
      style:display="flex"
      style:flex-direction="column"
      style:gap={rest.gap ? `${rest.gap}px` : undefined}
    >
      {#each rows as item (getKey(item))}
        <!-- `flow-root` keeps the children's margins inside the measured border box. -->
        <div role="listitem" data-key={getKey(item)} class={rowClass} style="display: flow-root">{@render children?.(item)}</div>
      {/each}
    </div>
    {@render footer?.()}
  </div>
</div>
