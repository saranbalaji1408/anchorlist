<script lang="ts">
  import type { FollowContext, VirtualizerOptions } from '@anchorlist/core'
  import { rtlScroller } from '@anchorlist/core/rtl'
  import { snapshotEstimate } from '@anchorlist/core/snapshot'
  import { initialPlan } from '@anchorlist/core/ssr'
  import { windowScroller } from '@anchorlist/core/window'
  import { AnchorList, type AnchorListProps } from '@anchorlist/svelte'
  import { horizontal as horizontalLayout } from '@anchorlist/svelte/horizontal'
  import { LanesList } from '@anchorlist/svelte/lanes'
  import { StickyItem } from '@anchorlist/svelte/sticky'
  import type { Item } from '../../../scenarios/src/driver'
  import Bubble from './Bubble.svelte'
  import { store } from './store.svelte'

  const s = $derived(store.state)
  const config = store.config
  const layout = config.layout ?? 'vertical'
  const margin = config.scrollMargin ?? 0
  const lanes = store.lanes
  // Header and footer sizes are along the main axis.
  const size = store.horizontal ? 'width' : 'height'
  const getKey = (item: Item): string => item.id
  const isHeader = (item: Item): boolean => !!item.header
  const follow = ({ atEdge, added }: FollowContext): boolean => {
    const { items, align } = store.state
    return atEdge || (align === 'end' ? items.slice(-added) : items.slice(0, added)).some((m) => m.mine)
  }
  const initialSnapshot = config.initialSnapshot
  const estimate = $derived(s.estimate === null ? undefined : () => s.estimate!)
  // Read on mount, like the scroller.
  const scroller: AnchorListProps<Item>['scroller'] =
    layout === 'horizontal'
      ? horizontalLayout()
      : layout === 'rtl'
        ? horizontalLayout(rtlScroller)
        : layout === 'window'
          ? (e) => windowScroller({ ...e, scrollMargin: margin })
          : undefined
  const sizedEstimate = $derived(
    initialSnapshot?.sizes ? snapshotEstimate(initialSnapshot, (i) => store.state.items[i]!.id, estimate) : estimate,
  )
  const props: Omit<AnchorListProps<Item>, 'items' | 'getKey'> = $derived({
    id: 'scroller',
    dir: layout === 'rtl' ? 'rtl' : undefined,
    style: layout === 'window' ? `width: ${s.width}px` : `height: ${s.height}px; width: ${s.width}px; border: none`,
    align: s.align,
    gap: s.gap,
    paddingStart: s.paddingStart,
    paddingEnd: s.paddingEnd,
    hasMoreStart: s.hasMoreStart,
    hasMoreEnd: s.hasMoreEnd,
    busy: s.busy,
    onStartReached: () => void store.events.startReached++,
    onEndReached: () => void store.events.endReached++,
    onAtEdgeChange: (at: boolean) => void store.events.atEdge.push(at),
    estimateSize: sizedEstimate,
    overscan: s.overscan ?? undefined,
    follow: s.followMine ? follow : undefined,
    initialSnapshot,
    ...(config.initialRect ? { initialRect: config.initialRect, initialPlan: initialPlan as VirtualizerOptions['initialPlan'] } : {}),
    scroller,
    header: s.header === null ? undefined : header,
    footer: s.footer === null ? undefined : footer,
    sticky: s.stickyItems ? stuck : s.sticky ? pill : undefined,
  })
</script>

<main style:padding-top={layout === 'window' ? `${margin}px` : undefined}>
  {#if layout === 'window' && margin > 0}
    <div id="appbar" style="position: fixed; top: 0; left: 0; right: 0; height: {margin}px; background: #fde; z-index: 2"></div>
  {/if}
  <h1>anchorlist fixture</h1>
  {#if lanes}
    <LanesList bind:this={store.list} items={s.items} {getKey} {...props} {lanes}>
      {#snippet children(item)}
        <Bubble {item} />
      {/snippet}
    </LanesList>
  {:else}
    <AnchorList bind:this={store.list} items={s.items} {getKey} {...props}>
      {#snippet children(item)}
        <Bubble {item} />
      {/snippet}
    </AnchorList>
  {/if}
</main>

{#snippet header()}
  <div style="{size}: {s.header}px; background: #eef">header</div>
{/snippet}
{#snippet footer()}
  <div style="{size}: {s.footer}px; background: #efe">footer</div>
{/snippet}
{#snippet pill(range: { startKey: string | number | null })}
  <div data-testid="pill">{range.startKey}</div>
{/snippet}
{#snippet stuck(range: import('@anchorlist/core').VisibleRange)}
  <StickyItem {range} items={s.items} isSticky={isHeader}>
    {#snippet children(item)}
      <div data-testid="stuck"><Bubble {item} /></div>
    {/snippet}
  </StickyItem>
{/snippet}
