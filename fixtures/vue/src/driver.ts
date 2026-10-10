import { AnchorList, type AnchorListHandle, type AnchorListProps } from '@anchorlist/vue'
import type { FollowContext, VisibleRange } from '@anchorlist/core'
import { createApp, defineComponent, h, nextTick, reactive, shallowRef, version, type App, type PropType, type VNodeChild } from 'vue'
import { createDom } from '../../../scenarios/src/dom'
import type { Driver, Events, Item, ListState } from '../../../scenarios/src/driver'

const SCROLLER_ID = 'scroller'

// ------------------------------------------------------------- row content

const heights = reactive(new Map<string, number>())
const boxes = new Map<string, HTMLElement>()
let renders: Record<string, number> = {}
let withoutScroller: string[] = []

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
      return h(
        'div',
        {
          ref,
          style: {
            height: height === undefined ? undefined : `${height}px`,
            boxSizing: 'border-box',
            borderBottom: '1px solid #ccc',
            overflowWrap: 'anywhere',
          },
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
const intern = (items: Item[]): Item[] =>
  items.map((m) => {
    const prev = interned.get(m.id)
    if (prev && prev.height === m.height && prev.text === m.text && prev.mine === m.mine) return prev
    interned.set(m.id, m)
    return m
  })

// ------------------------------------------------------------------ driver

export function installDriver(container: HTMLElement): void {
  let app: App | null = null
  const state = shallowRef<ListState>(DEFAULTS)
  let list: AnchorListHandle | null = null
  const setList = (r: unknown): void => void (list = r as AnchorListHandle | null)
  const dom = createDom(SCROLLER_ID)
  const handle = (): AnchorListHandle => {
    if (!list) throw new Error('list not mounted')
    return list
  }

  const driver: Driver = {
    ...dom,
    async mount(config) {
      app?.unmount()
      heights.clear()
      driver.resetCounters()
      interned.clear()
      // Vue has no strict mode: `config.strict` is ignored.
      state.value = { ...DEFAULTS, ...config, items: intern(config.items) }
      const initialSnapshot = config.initialSnapshot
      app = createApp({
        render() {
          const s = state.value
          const { items, align } = s
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
            ...callbacks,
            ...(s.estimate === null ? {} : { estimateSize: () => s.estimate! }),
            ...(s.overscan === null ? {} : { overscan: s.overscan }),
            ...(s.followMine ? { follow } : {}),
            ...(initialSnapshot ? { initialSnapshot } : {}),
          }
          return h('main', [
            h('h1', 'anchorlist fixture'),
            h(
              AnchorList<Item>,
              { ...props, ref: setList, id: SCROLLER_ID, style: { height: `${s.height}px`, width: `${s.width}px`, border: 'none' } },
              {
                default: renderItem,
                ...(s.header === null ? {} : { header: () => h('div', { style: { height: `${s.header}px`, background: '#eef' } }, 'header') }),
                ...(s.footer === null ? {} : { footer: () => h('div', { style: { height: `${s.footer}px`, background: '#efe' } }, 'footer') }),
                ...(s.sticky ? { sticky: pill } : {}),
              },
            ),
          ])
        },
      })
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
      if (box) box.style.height = `${height}px`
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
    resetCounters() {
      renders = {}
      withoutScroller = []
      events = { startReached: 0, endReached: 0, atEdge: [] }
    },
  }
  window.__driver = driver
}
