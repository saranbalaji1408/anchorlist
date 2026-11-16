<!-- Test-only: AnchorList with StickyItem, or a pill, in a StickyOverlay. -->
<script lang="ts">
  import AnchorList from './AnchorList.svelte'
  import StickyItem from './StickyItem.svelte'
  import StickyOverlay from './StickyOverlay.svelte'

  const { items, isSticky, pill = false }: { items: { id: string }[]; isSticky: (m: { id: string }) => boolean; pill?: boolean } = $props()
</script>

<AnchorList id="sc" {items} getKey={(m) => m.id} estimateSize={() => 50}>
  {#snippet children(m)}<span>{m.id}</span>{/snippet}
  {#snippet sticky(list)}
    <StickyOverlay {list}>
      {#snippet children(range)}
        {#if pill}
          <span data-testid="pill">{range.startKey}</span>
        {:else}
          <StickyItem {range} {items} {isSticky}>
            {#snippet children(m)}<span>{m.id}</span>{/snippet}
          </StickyItem>
        {/if}
      {/snippet}
    </StickyOverlay>
  {/snippet}
</AnchorList>
