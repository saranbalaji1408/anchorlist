<script lang="ts">
  import type { Item } from '../../../scenarios/src/driver'
  import { store } from './store.svelte'

  const { item }: { item: Item } = $props()
  const height = $derived(store.heights.get(item.id) ?? item.height)

  // Counts content updates: a row updates only when its item changes.
  $effect.pre(() => {
    const { id } = item
    store.renders[id] = (store.renders[id] ?? 0) + 1
    if (!document.getElementById('scroller')) store.withoutScroller.push(id)
  })
</script>

<div
  style:height={height === undefined ? undefined : `${height}px`}
  style:box-sizing="border-box"
  style:border-bottom="1px solid #ccc"
  style:overflow-wrap="anywhere"
>
  {item.text ?? item.id}
</div>
