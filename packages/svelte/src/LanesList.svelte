<!--
  @component
  `AnchorList` with items laid out in lanes (a grid or masonry), positioned
  absolutely. It takes every `AnchorList` prop plus `lanes`; the lanes own the
  gap, and `paddingStart` / `paddingEnd` are not used. A custom `scroller`
  (for example `horizontal()` with `grid({ lanes, horizontal: true })`, or
  `windowScroller`) is wrapped by the lanes. Keep `overscan` (default 400) at
  least as large as the largest item: masonry items sit up to one item away
  from their position on the engine's axis, and a grid row at the edge of the
  overscan may be rendered in part.

  ```svelte
  <script>
    const lanes = masonry({ lanes: 3, gap: 8 })
  </script>
  <LanesList style="height: 600px" items={photos} getKey={(p) => p.id} {lanes}>
    {#snippet children(photo)}<Photo {photo} />{/snippet}
  </LanesList>
  ```
-->
<script lang="ts" generics="T">
  import { elementScroller, type ElementScrollerOptions, type Plan, type VirtualizerOptions } from '@anchorlist/core'
  import AnchorList from './AnchorList.svelte'
  import type { LanesListProps } from './lanesTypes.js'
  import type { AnchorListHandle as H } from './types.js'

  const { lanes, ...props }: LanesListProps<T> = $props()

  const options = $derived({ ...props, count: props.items.length, getKey: (i: number) => props.getKey(props.items[i]!) } as VirtualizerOptions)
  // The lanes' estimates, and no gap or padding.
  const laneOptions = $derived.by(() => {
    const { count: _, getKey: __, ...o } = lanes.options(options)
    return o
  })
  // Before the list plans and commits: hands the items to the lanes.
  $effect.pre(() => lanes.sync(options))

  let list: H
  const scroller = (e: ElementScrollerOptions) => {
    // Items are positioned absolutely inside the list.
    e.list.style.position = 'relative'
    // AnchorList leaves overflow to a custom scroller: the default one scrolls the container.
    if (!props.scroller) (e.element as HTMLElement).style.overflowY = 'auto'
    return lanes.scroller((props.scroller ?? elementScroller)(e))
  }

  // Whole grid rows; masonry renders the plan's range.
  const rows = (p: Plan) => lanes.range(p, p.options.count)

  export const scrollToKey: H['scrollToKey'] = (...a) => list.scrollToKey(...a)
  export const scrollToIndex: H['scrollToIndex'] = (...a) => list.scrollToIndex(...a)
  export const scrollToEdge: H['scrollToEdge'] = (...a) => list.scrollToEdge(...a)
  export const isAtEdge: H['isAtEdge'] = (...a) => list.isAtEdge(...a)
  export const getSnapshot: H['getSnapshot'] = () => list.getSnapshot()
  export const getVisibleRange: H['getVisibleRange'] = () => list.getVisibleRange()
  export const getItemRect: H['getItemRect'] = (...a) => list.getItemRect(...a)
  export const getTotalSize: H['getTotalSize'] = () => list.getTotalSize()
  export const indexOf: H['indexOf'] = (...a) => list.indexOf(...a)
  export const subscribe: H['subscribe'] = (...a) => list.subscribe(...a)
  export const getElement: H['getElement'] = () => list.getElement()
</script>

<AnchorList bind:this={list} {...props} {...laneOptions} {scroller} {rows} />
