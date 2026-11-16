<!--
  @component
  Sticky items (for example group headers) for `AnchorList`: the last sticky
  item scrolled past stays at the top of the viewport until the next one
  pushes it out. Render it from the `sticky` snippet:

  ```svelte
  <AnchorList items={rows} {getKey}>
    {#snippet children(row)}<Row {row} />{/snippet}
    {#snippet sticky(range)}
      <StickyItem {range} items={rows} isSticky={isHeader}>
        {#snippet children(row)}<Row {row} />{/snippet}
      </StickyItem>
    {/snippet}
  </AnchorList>
  ```

  The rows themselves stay in normal flow and are never `position: sticky`;
  this renders an `aria-hidden`, `inert` copy of the stuck item over them, so
  screen readers read each header once, in its place, and keyboard focus never
  lands in the copy. Being inert, the copy does not receive clicks either: they
  reach whatever is under it (the header row itself while it is in view).
-->
<script lang="ts" generics="T">
  import { stickyState } from '@anchorlist/core/sticky'
  import type { StickyItemProps } from './stickyTypes.js'

  const { range, items, isSticky, children }: StickyItemProps<T> = $props()

  let el: HTMLDivElement
  let index = $state(-1)

  const update = (): void => {
    // The `sticky` overlay sits directly inside the scroll container.
    const s = stickyState(el.parentElement!.parentElement!, range, (i) => i < items.length && isSticky(items[i]!), el.offsetHeight)
    el.style.transform = `translateY(${s.offset}px)`
    index = s.index
  }
  // After every update, like a layout effect: the stuck item's size changes with `index`.
  $effect(() => {
    void index
    update()
  })
  $effect(() => {
    const sc = el.parentElement!.parentElement!
    const onScroll = (): void => update()
    sc.addEventListener('scroll', onScroll)
    return () => sc.removeEventListener('scroll', onScroll)
  })
  const item = $derived(items[index])
</script>

<div bind:this={el} aria-hidden="true" inert>
  {#if item !== undefined}{@render children?.(item)}{/if}
</div>
