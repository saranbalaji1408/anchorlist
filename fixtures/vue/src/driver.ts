import { elementScroller, HORIZONTAL, type FollowContext, type Virtualizer, type VisibleRange } from '@anchorlist/core'
import { animateToKey } from '@anchorlist/core/animate'
import { grid, masonry, type Lanes } from '@anchorlist/core/lanes'
import { rtlScroller } from '@anchorlist/core/rtl'
import { snapshotEstimate, takeSnapshot } from '@anchorlist/core/snapshot'
import { initialPlan } from '@anchorlist/core/ssr'
import { windowScroller } from '@anchorlist/core/window'
import { AnchorList, type AnchorListHandle, type AnchorListProps } from '@anchorlist/vue'
import { horizontal as horizontalLayout } from '@anchorlist/vue/horizontal'
import { LanesList } from '@anchorlist/vue/lanes'
import { StickyItem, StickyOverlay } from '@anchorlist/vue/sticky'
import { createApp, createSSRApp, defineComponent, h, nextTick, reactive, shallowRef, version, type App, type Component, type PropType, type VNodeChild } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createDom } from '../../../scenarios/src/dom'
import type { Driver, Events, Item, ListState, MountConfig } from '../../../scenarios/src/driver'

const SCROLLER_ID = 'scroller'

// ------------------------------------------------------------- row content

const heights = reactive(new Map<string, number>())
const boxes = new Map<string, HTMLElement>()
let renders: Record<string, number> = {}
let withoutScroller: string[] = []
/** Rows run along the horizontal axis: item heights are widths. Set on mount. */
let horizontal = false
/** The mounted config, for helpers that need the layout (animateToKey's scroller). */
let mounted: MountConfig = { items: [] }

const Bubble = defineComponent({
  props: { item: { type: Object as PropType<Item>, required: true } },
  setup(props) {
    const id = props.item.id
    const ref = (el: unknown): void => void (el ? boxes.set(id, el as HTMLElement) : boxes.delete(id))
    return () => {
      const { item } = props
      renders[item.id] = (renders[item.id] ?? 0) + 1
      if (!document.getElementById(SCROLLER_ID)) withoutScroller.push(item.id)
      const height = heights.get(item.id) ?? item.height
      const size = height === undefined ? undefined : `${height}px`
      const background = item.header ? '#ffd' : '#fff'
      return h(
        'div',
        {
          ref,
          style: horizontal
            ? { width: size, height: '100%', boxSizing: 'border-box', borderInlineEnd: '1px solid #ccc', overflow: 'hidden', background }
            : { height: size, boxSizing: 'border-box', borderBottom: '1px solid #ccc', overflowWrap: 'anywhere', background },
        },
        item.text ?? item.id,
      )
    }
  },
})

// Module scope: stable slot functions.
const renderItem = ({ item }: { item: Item }): VNodeChild => h(Bubble, { item })
const getKey = (item: Item): string => item.id
const pill = (range: VisibleRange): VNodeChild => h('div', { 'data-testid': 'pill' }, String(range.startKey ?? ''))
const isHeader = (item: Item): boolean => !!item.header
const renderStuck = ({ item }: { item: Item }): VNodeChild => h('div', { 'data-testid': 'stuck' }, [h(Bubble, { item })])

// --------------------------------------------------------------------- app

const DEFAULTS: ListState = {
  items: [],
  align: 'end',
  height: 600,
  width: 400,
  header: null,
  footer: null,
  sticky: false,
  estimate: null,
  overscan: null,
  gap: 0,
  paddingStart: 0,
  paddingEnd: 0,
  hasMoreStart: false,
  hasMoreEnd: false,
  followMine: false,
  stickyItems: false,
  busy: false,
}

let events: Events = { startReached: 0, endReached: 0, atEdge: [] }
const callbacks = {
  onStartReached: () => void events.startReached++,
  onEndReached: () => void events.endReached++,
  onAtEdgeChange: (at: boolean) => void events.atEdge.push(at),
}

/**
 * Items arrive as fresh copies through each `page.evaluate`. Interning them by
 * id (when unchanged) keeps object identity like an immutable app store does,
 * so rows can skip re-rendering.
 */
const interned = new Map<string, Item>()
/** The items of the last render. */
let current: Item[] = []
const intern = (items: Item[]): Item[] =>
  items.map((m) => {
    const prev = interned.get(m.id)
    if (prev && prev.height === m.height && prev.text === m.text && prev.mine === m.mine && prev.header === m.header) return prev
    interned.set(m.id, m)
    return m
  })

// ------------------------------------------------------------------ driver

export function installDriver(container: HTMLElement): void {
  let app: App | null = null
  /** The root component of the last server render, hydrated by `hydrate()`. */
  let server: Component | undefined
  const state = shallowRef<ListState>(DEFAULTS)
  let list: AnchorListHandle | null = null
  const setList = (r: unknown): void => void (list = r as AnchorListHandle | null)
  const dom = createDom(SCROLLER_ID)
  const handle = (): AnchorListHandle => {
    if (!list) throw new Error('list not mounted')
    return list
  }

  /** The root component for `config`, after resetting the per-mount state. */
  const prepare = (config: MountConfig): Component => {
    app?.unmount()
    app = null
    list = null
    heights.clear()
    driver.resetCounters()
    interned.clear()
    // Vue has no strict mode: `config.strict` is ignored.
    state.value = { ...DEFAULTS, ...config, items: intern(config.items) }
    horizontal = config.layout === 'horizontal' || config.layout === 'rtl'
    mounted = config
    const l = config.lanes
    const lanes: Lanes | undefined = l && (l.kind === 'grid' ? grid : masonry)({ lanes: l.lanes, gap: l.gap ?? 0, horizontal })
    const layout = config.layout ?? 'vertical'
    const margin = config.scrollMargin ?? 0
    // Header and footer sizes are along the main axis.
    const size = horizontal ? 'width' : 'height'
    const { initialSnapshot, initialRect } = config
    return {
      render() {
        const s = state.value
        const { items, align } = s
        current = items
        const estimate = s.estimate === null ? undefined : () => s.estimate!
        const follow = ({ atEdge, added }: FollowContext): boolean =>
          atEdge || (align === 'end' ? items.slice(-added) : items.slice(0, added)).some((m) => m.mine)
        const props: AnchorListProps<Item> = {
          items,
          getKey,
          align,
          gap: s.gap,
          paddingStart: s.paddingStart,
          paddingEnd: s.paddingEnd,
          hasMoreStart: s.hasMoreStart,
          hasMoreEnd: s.hasMoreEnd,
          busy: s.busy,
          ...callbacks,
          ...(estimate ? { estimateSize: estimate } : {}),
          ...(s.overscan === null ? {} : { overscan: s.overscan }),
          ...(s.followMine ? { follow } : {}),
          ...(initialSnapshot ? { initialSnapshot } : {}),
          ...(initialSnapshot?.sizes ? { estimateSize: snapshotEstimate(initialSnapshot, (i) => items[i]!.id, estimate) } : {}),
          ...(initialRect ? { initialRect, initialPlan } : {}),
          ...(layout === 'horizontal' ? { scroller: horizontalLayout() } : {}),
          ...(layout === 'rtl' ? { scroller: horizontalLayout(rtlScroller) } : {}),
          ...(layout === 'window' ? { scroller: (e) => windowScroller({ ...e, scrollMargin: margin }) } : {}),
        }
        const attrs = {
          ref: setList,
          id: SCROLLER_ID,
          ...(layout === 'rtl' ? { dir: 'rtl' } : {}),
          // The page scrolls: the container has no height, and a fixed bar covers the top `margin` px.
          style: layout === 'window' ? { width: `${s.width}px` } : { height: `${s.height}px`, width: `${s.width}px`, border: 'none' },
        }
        const slots = {
          default: renderItem,
          ...(s.header === null ? {} : { header: () => h('div', { style: { [size]: `${s.header}px`, background: '#eef' } }, 'header') }),
          ...(s.footer === null ? {} : { footer: () => h('div', { style: { [size]: `${s.footer}px`, background: '#efe' } }, 'footer') }),
          ...(s.sticky ? { sticky: (list: Virtualizer) => h(StickyOverlay, { list }, { default: pill }) } : {}),
          ...(s.stickyItems
            ? {
                sticky: (list: Virtualizer) =>
                  h(StickyOverlay, { list }, { default: (range: VisibleRange) => h(StickyItem<Item>, { range, items, isSticky: isHeader }, { default: renderStuck }) }),
              }
            : {}),
        }
        return h('main', { style: layout === 'window' ? { paddingTop: `${margin}px` } : undefined }, [
          layout === 'window' && margin > 0
            ? h('div', { id: 'appbar', style: { position: 'fixed', top: 0, left: 0, right: 0, height: `${margin}px`, background: '#fde', zIndex: 2 } })
            : null,
          h('h1', 'anchorlist fixture'),
          lanes ? h(LanesList<Item>, { ...props, ...attrs, lanes }, slots) : h(AnchorList<Item>, { ...props, ...attrs }, slots),
        ])
      },
    }
  }

  const driver: Driver = {
    ...dom,
    async mount(config) {
      app = createApp(prepare(config))
      app.mount(container)
      await dom.frames(2)
    },
    async unmount() {
      app?.unmount()
      app = null
      list = null
      await dom.frames(1)
    },
    async update(patch) {
      // Vue renders asynchronously: both modes are flushed before this resolves (before paint).
      if (patch.items) patch = { ...patch, items: intern(patch.items) }
      state.value = { ...state.value, ...patch }
      await nextTick()
    },
    setItemHeight(id, height) {
      heights.set(id, height)
      // Committed synchronously, like the other fixtures: Vue patches the same value later.
      const box = boxes.get(id)
      if (box) box.style[horizontal ? 'width' : 'height'] = `${height}px`
    },
    scrollToKey: (key, o) => handle().scrollToKey(key, o),
    scrollToIndex: (i, o) => handle().scrollToIndex(i, o),
    scrollToEdge: (edge) => handle().scrollToEdge(edge),
    isAtEdge: (edge) => handle().isAtEdge(edge),
    getSnapshot: () => handle().getSnapshot(),
    getVisibleRange: () => handle().getVisibleRange(),
    getItemRect: (key) => handle().getItemRect(key),
    events: () => ({ ...events, atEdge: [...events.atEdge] }),
    renders: () => ({ ...renders }),
    rendersWithoutScroller: () => [...withoutScroller],
    frameworkVersion: () => version,
    animateToKey(key, o) {
      const element = handle().element
      const layout = mounted.layout
      // The scroller animateToKey reads and writes the offset through, per layout.
      const scroller =
        layout === 'window'
          ? windowScroller({ list: element, scrollMargin: mounted.scrollMargin ?? 0 })
          : layout === 'rtl'
            ? rtlScroller({ element, list: element })
            : layout === 'horizontal'
              ? elementScroller({ element, list: element, axis: HORIZONTAL })
              : undefined
      return animateToKey(handle(), element, key, { ...o, ...(scroller && { scroller }) })
    },
    takeSnapshot() {
      const items = current
      return takeSnapshot(handle(), (i) => items[i]!.id, items.length)
    },
    async serverRender(config) {
      server = prepare(config)
      // A string render, as on a server; `hydrate()` adopts it with the same root and state.
      container.innerHTML = await renderToString(createSSRApp(server))
      return Array.from(container.querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key ?? '')
    },
    async hydrate() {
      app = createSSRApp(server!)
      app.mount(container)
      await dom.frames(2)
    },
    resetCounters() {
      renders = {}
      withoutScroller = []
      events = { startReached: 0, endReached: 0, atEdge: [] }
    },
  }
  window.__driver = driver
}
