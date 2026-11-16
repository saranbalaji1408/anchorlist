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
    'estimateSize align overscan gap paddingStart paddingEnd hasMoreStart hasMoreEnd startThreshold endThreshold onStartReached onEndReached atEdgeThreshold follow onRangeChange onAtEdgeChange initialSnapshot maxCachedSizes initialRect initialPlan'.split(
      ' ',
    ),
  )
</script>

<script lang="ts" generics="T">
  import { elementScroller, type ElementScrollerOptions, type Scroller, type VirtualizerOptions } from '@anchorlist/core'
  import { createAnchorList } from './createAnchorList.svelte.js'
  import type { AnchorListHandle, AnchorListProps } from './types.js'

  const { items, getKey, children, header, footer, sticky, rowClass, busy, scroller, rows: toRows, ...rest }: AnchorListProps<T> = $props()

  let element: HTMLDivElement | undefined = $state()
  let content: HTMLElement | undefined = $state()
  let list: HTMLElement | undefined = $state()
  // The container's overflow as set when attaching. Rendered in the style
  // attribute so that a changed `style` prop keeps it.
  let overflow: string | undefined = $state()
  let sc: Scroller<Element>

  const al = createAnchorList(
    () => {
      // A snapshot: the engine calls getKey for the list as it was when planned.
      const all = items
      const key = getKey
      // Undefined options mean their defaults in the core.
      return { ...rest, count: all.length, getKey: (i: number) => key(all[i]!) } as VirtualizerOptions
    },
    () => element && list && content && { element, list, content },
    // Read on mount.
    (e: ElementScrollerOptions) => {
      const s = (sc = (scroller ?? elementScroller)(e))
      const { style } = e.element as HTMLElement
      overflow = `overflow-x:${style.overflowX};overflow-y:${scroller ? style.overflowY : 'auto'}`
      return s
    },
    (p) => toRows?.(p) ?? p,
  )
  const v = al.virtualizer
  // The focused row stays mounted outside the range, out of flow, in the same
  // keyed block as the rows so that Svelte never moves its node (see keptRow).
  // A horizontal list keeps it at its inline start (content space either way).
  const kept = $derived.by(() => {
    const k = al.kept
    if (!k) return k
    const x = list!.style.flexDirection == 'row'
    // `k.start` is in the scroller's content space (the page for a window
    // scroller); the row's containing block is the container. Rebase from the
    // list's start in one to its start in the other (a no-op when the
    // container is the scroller).
    const e = element!
    const at = x ? k.start : k.start - sc.listStart() - sc.offset() + list!.getBoundingClientRect().top - e.getBoundingClientRect().top + e.scrollTop
    return { item: items[k.index]!, i: k.index, style: `position:absolute;${x ? 'height' : 'width'}:100%;${x ? 'inset-inline-start' : 'top'}:${at}px` }
  })
  // Items, never wrappers, so that unchanged rows are not updated.
  const rows = $derived.by(() => {
    const { start, end } = al.rows
    const r = items.slice(start, end + 1)
    if (kept) r[kept.i < start ? 'unshift' : 'push'](kept.item)
    return r
  })
  const attrs = $derived(Object.fromEntries(Object.entries(rest).filter(([k]) => !OPTIONS.has(k))))

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
  export const getElement: AnchorListHandle['getElement'] = () => element!
</script>

<div
  {...attrs}
  bind:this={element}
  style="{attrs.style ?? ''};{overflow ?? (scroller ? '' : 'overflow-y:auto')};overflow-anchor:none;position:relative"
>
  {@render sticky?.(v)}
  <div bind:this={content}>
    {@render header?.()}
    <div
      bind:this={list}
      role="list"
      aria-busy={busy}
      style:display="flex"
      style:flex-direction="column"
      style:gap={rest.gap ? `${rest.gap}px` : undefined}
      onfocusout={() => {
        // Focus that leaves the window stays in the row: keep it.
        if (document.hasFocus()) al.focused = null
      }}
    >
      {#each rows as item (getKey(item))}
        <!-- `flow-root` keeps the children's margins inside the measured border box. -->
        <div
          role="listitem"
          data-key={getKey(item)}
          class={rowClass}
          style={item === kept?.item ? kept.style : 'display:flow-root'}
          onfocusin={() => (al.focused = getKey(item))}
        >
          {@render children?.(item)}
        </div>
      {/each}
    </div>
    {@render footer?.()}
  </div>
</div>
