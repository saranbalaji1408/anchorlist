<script lang="ts">
  import type { FollowContext } from '@anchorlist/core'
  import { AnchorList } from '@anchorlist/svelte'
  import type { Item } from '../../../scenarios/src/driver'
  import Bubble from './Bubble.svelte'
  import { store } from './store.svelte'

  const s = $derived(store.state)
  const getKey = (item: Item): string => item.id
  const follow = ({ atEdge, added }: FollowContext): boolean => {
    const { items, align } = store.state
    return atEdge || (align === 'end' ? items.slice(-added) : items.slice(0, added)).some((m) => m.mine)
  }
  const initialSnapshot = store.config.initialSnapshot
</script>

<main>
  <h1>anchorlist fixture</h1>
  <AnchorList
    bind:this={store.list}
    id="scroller"
    style="height: {s.height}px; width: {s.width}px; border: none"
    items={s.items}
    {getKey}
    align={s.align}
    gap={s.gap}
    paddingStart={s.paddingStart}
    paddingEnd={s.paddingEnd}
    hasMoreStart={s.hasMoreStart}
    hasMoreEnd={s.hasMoreEnd}
    onStartReached={() => void store.events.startReached++}
    onEndReached={() => void store.events.endReached++}
    onAtEdgeChange={(at) => void store.events.atEdge.push(at)}
    estimateSize={s.estimate === null ? undefined : () => s.estimate!}
    overscan={s.overscan ?? undefined}
    follow={s.followMine ? follow : undefined}
    {initialSnapshot}
    header={s.header === null ? undefined : header}
    footer={s.footer === null ? undefined : footer}
    sticky={s.sticky ? pill : undefined}
  >
    {#snippet children(item)}
      <Bubble {item} />
    {/snippet}
  </AnchorList>
</main>

{#snippet header()}
  <div style="height: {s.header}px; background: #eef">header</div>
{/snippet}
{#snippet footer()}
  <div style="height: {s.footer}px; background: #efe">footer</div>
{/snippet}
{#snippet pill(range: { startKey: string | number | null })}
  <div data-testid="pill">{range.startKey}</div>
{/snippet}
