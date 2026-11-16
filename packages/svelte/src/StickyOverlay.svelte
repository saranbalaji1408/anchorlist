<!--
  @component
  Overlay pinned to the top of the viewport (for example a date pill),
  rendered from the visible range. It updates only when that range changes.
  Render it in the `sticky` snippet of `AnchorList`:

  ```svelte
  {#snippet sticky(list)}
    <StickyOverlay {list}>
      {#snippet children(range)}<DatePill at={range.startKey} />{/snippet}
    </StickyOverlay>
  {/snippet}
  ```
-->
<script lang="ts">
  import type { VisibleRange } from '@anchorlist/core'
  import { untrack } from 'svelte'
  import type { StickyOverlayProps } from './stickyTypes.js'

  const { list, children }: StickyOverlayProps = $props()

  let range: VisibleRange = $state.raw(untrack(() => list.getVisibleRange()))
  $effect(() => list.subscribe(() => (range = list.getVisibleRange())))
</script>

<div style="position:sticky;top:0;height:0;z-index:1">{@render children?.(range)}</div>
