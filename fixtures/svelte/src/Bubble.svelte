<script lang="ts">
  import type { Item } from '../../../scenarios/src/driver'
  import { store } from './store.svelte'

  const { item }: { item: Item } = $props()
  const height = $derived(store.heights.get(item.id) ?? item.height)
  const px = $derived(height === undefined ? undefined : `${height}px`)

  const count = (): void => {
    const { id } = item
    store.renders[id] = (store.renders[id] ?? 0) + 1
    if (!document.getElementById('scroller')) store.withoutScroller.push(id)
  }
  // Effects do not run on the server: count the server render here.
  if (store.server) count()
  // Counts content updates: a row updates only when its item changes.
  $effect.pre(count)
</script>

{#if store.horizontal}
  <div
    style:width={px}
    style:height="100%"
    style:box-sizing="border-box"
    style:border-inline-end="1px solid #ccc"
    style:overflow="hidden"
    style:background={item.header ? '#ffd' : '#fff'}
  >
    {item.text ?? item.id}
  </div>
{:else}
  <div
    style:height={px}
    style:box-sizing="border-box"
    style:border-bottom="1px solid #ccc"
    style:overflow-wrap="anywhere"
    style:background={item.header ? '#ffd' : '#fff'}
  >
    {item.text ?? item.id}
  </div>
{/if}
