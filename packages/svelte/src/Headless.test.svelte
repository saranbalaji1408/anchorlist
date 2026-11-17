<!-- Test-only: custom markup driven by createAnchorList. -->
<script lang="ts">
  import { createAnchorList } from './createAnchorList.svelte.js'

  const { items, spinner = false }: { items: string[]; spinner?: boolean } = $props()
  let element: HTMLElement | undefined = $state()
  let list: HTMLElement | undefined = $state()
  const al = createAnchorList(
    () => ({ count: items.length, getKey: (i) => items[i]!, align: 'end' }),
    () => element && list && { element, list },
  )
</script>

<div id="sc" bind:this={element} style="overflow-anchor: none">
  <div role="list" bind:this={list}>
    {#if spinner}<div class="spinner">loading</div>{/if}
    {#each items.slice(al.plan.start, al.plan.end + 1) as k (k)}
      <div role="listitem" data-key={k}>{k}</div>
    {/each}
  </div>
</div>
