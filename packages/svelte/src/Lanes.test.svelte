<!-- Test-only: LanesList with a lane layout. -->
<script lang="ts">
  import type { Lanes } from '@anchorlist/core/lanes'
  import LanesList from './LanesList.svelte'
  import type { AnchorListHandle } from './types.js'

  let {
    items,
    lanes,
    getKey = (m) => m.id,
    list = $bindable(),
  }: { items: { id: string }[]; lanes: Lanes; getKey?: (m: { id: string }) => string; list?: AnchorListHandle } = $props()
</script>

<LanesList bind:this={list} id="sc" {items} {getKey} {lanes} gap={30}>
  {#snippet children(m)}<span>{m.id}</span>{/snippet}
</LanesList>
