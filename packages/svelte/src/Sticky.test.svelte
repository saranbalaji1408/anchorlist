<!-- Test-only: AnchorList with StickyItem in the sticky snippet. -->
<script lang="ts">
  import AnchorList from './AnchorList.svelte'
  import StickyItem from './StickyItem.svelte'

  const { items, isSticky }: { items: { id: string }[]; isSticky: (m: { id: string }) => boolean } = $props()
</script>

<AnchorList id="sc" {items} getKey={(m) => m.id} estimateSize={() => 50}>
  {#snippet children(m)}<span>{m.id}</span>{/snippet}
  {#snippet sticky(range)}
    <StickyItem {range} {items} {isSticky}>
      {#snippet children(m)}<span>{m.id}</span>{/snippet}
    </StickyItem>
  {/snippet}
</AnchorList>
