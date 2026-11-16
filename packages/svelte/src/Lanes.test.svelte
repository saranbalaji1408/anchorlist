<!-- Test-only: LanesList with a lane layout. -->
<script lang="ts">
  import type { Lanes } from '@anchorlist/core/lanes'
  import LanesList from './LanesList.svelte'
  import type { AnchorListHandle } from './types.js'

  let { items, lanes, list = $bindable() }: { items: { id: string }[]; lanes: Lanes; list?: AnchorListHandle } = $props()
</script>

<LanesList bind:this={list} id="sc" {items} getKey={(m) => m.id} {lanes} gap={30}>
  {#snippet children(m)}<span>{m.id}</span>{/snippet}
</LanesList>
