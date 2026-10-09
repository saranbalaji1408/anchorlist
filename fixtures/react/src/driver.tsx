import { AnchorList, type AnchorListHandle, type AnchorListProps, type FollowContext } from 'anchorlist'
import { StrictMode, startTransition, useLayoutEffect, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { createDom } from '../../../scenarios/src/dom'
import type { Driver, Events, Item, ListState, MountConfig } from '../../../scenarios/src/driver'

const SCROLLER_ID = 'scroller'

// ------------------------------------------------------------- row content

const heights = new Map<string, number>()
const heightListeners = new Set<() => void>()
const subscribeHeights = (l: () => void): (() => void) => {
  heightListeners.add(l)
  return () => heightListeners.delete(l)
}
let renders: Record<string, number> = {}
let withoutScroller: string[] = []

function Bubble({ item }: { item: Item }): ReactNode {
  const height = useSyncExternalStore(subscribeHeights, () => heights.get(item.id) ?? item.height)
  renders[item.id] = (renders[item.id] ?? 0) + 1
  if (!document.getElementById(SCROLLER_ID)) withoutScroller.push(item.id)
  return (
    <div style={{ height, boxSizing: 'border-box', borderBottom: '1px solid #ccc', overflowWrap: 'anywhere' }}>
      {item.text ?? item.id}
    </div>
  )
}

// Module scope: a stable renderItem lets memoised rows skip re-renders.
const renderItem = (item: Item): ReactNode => <Bubble item={item} />
const getKey = (item: Item): string => item.id
const pill = (range: { startKey: string | number | null }): ReactNode => <div data-testid="pill">{range.startKey}</div>

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

interface Bridge {
  set: (update: (s: ListState) => ListState) => void
  committed: () => void
}

function App({ init, config, bridge, list }: { init: ListState; config: MountConfig; bridge: Bridge; list: RefObject<AnchorListHandle | null> }): ReactNode {
  const [s, set] = useState(init)
  bridge.set = set
  const { items, align } = s
  const follow = ({ atEdge, added }: FollowContext): boolean =>
    atEdge || (align === 'end' ? items.slice(-added) : items.slice(0, added)).some((m) => m.mine)
  const props: AnchorListProps<Item> = {
    items,
    getKey,
    renderItem,
    align,
    gap: s.gap,
    paddingStart: s.paddingStart,
    paddingEnd: s.paddingEnd,
    hasMoreStart: s.hasMoreStart,
    hasMoreEnd: s.hasMoreEnd,
    ...callbacks,
    style: { height: s.height, width: s.width, border: 'none' },
    scrollerProps: { id: SCROLLER_ID },
    header: s.header === null ? null : <div style={{ height: s.header, background: '#eef' }}>header</div>,
    footer: s.footer === null ? null : <div style={{ height: s.footer, background: '#efe' }}>footer</div>,
    ...(s.sticky ? { sticky: pill } : {}),
    ...(s.estimate === null ? {} : { estimateSize: () => s.estimate! }),
    ...(s.overscan === null ? {} : { overscan: s.overscan }),
    ...(s.followMine ? { follow } : {}),
    ...(config.initialSnapshot ? { initialSnapshot: config.initialSnapshot } : {}),
  }
  return (
    <main>
      <h1>anchorlist fixture</h1>
      <AnchorList<Item> ref={list} {...props} />
      <Committed s={s} onCommit={bridge.committed} />
    </main>
  )
}

/** Reports each committed state so transition updates can be awaited. */
function Committed({ s, onCommit }: { s: ListState; onCommit: () => void }): ReactNode {
  useLayoutEffect(onCommit, [s, onCommit])
  return null
}

// ------------------------------------------------------------------ driver

/**
 * Items arrive as fresh copies through each `page.evaluate`. Interning them by
 * id (when unchanged) keeps object identity like an immutable app store does,
 * so memoised rows can skip re-rendering.
 */
const interned = new Map<string, Item>()
const intern = (items: Item[]): Item[] =>
  items.map((m) => {
    const prev = interned.get(m.id)
    if (prev && prev.height === m.height && prev.text === m.text && prev.mine === m.mine) return prev
    interned.set(m.id, m)
    return m
  })

export function installDriver(container: HTMLElement): void {
  let root: Root | null = null
  const list: RefObject<AnchorListHandle | null> = { current: null }
  const waiters: Array<() => void> = []
  const bridge: Bridge = {
    set: () => undefined,
    committed: () => waiters.splice(0).forEach((w) => w()),
  }
  const dom = createDom(SCROLLER_ID)
  const handle = (): AnchorListHandle => {
    if (!list.current) throw new Error('list not mounted')
    return list.current
  }

  const driver: Driver = {
    ...dom,
    async mount(config) {
      root?.unmount()
      heights.clear()
      driver.resetCounters()
      interned.clear()
      const init: ListState = { ...DEFAULTS, ...config, items: intern(config.items) }
      const app = <App init={init} config={config} bridge={bridge} list={list} />
      root = createRoot(container)
      root.render(config.strict ? <StrictMode>{app}</StrictMode> : app)
      await dom.frames(2)
    },
    async unmount() {
      root?.unmount()
      root = null
      await dom.frames(1)
    },
    async update(patch, mode = 'sync') {
      if (patch.items) patch = { ...patch, items: intern(patch.items) }
      const apply = (s: ListState): ListState => ({ ...s, ...patch })
      if (mode === 'sync') return flushSync(() => bridge.set(apply))
      const done = new Promise<void>((r) => waiters.push(r))
      startTransition(() => bridge.set(apply))
      await done
    },
    setItemHeight(id, height) {
      heights.set(id, height)
      flushSync(() => heightListeners.forEach((l) => l()))
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
    resetCounters() {
      renders = {}
      withoutScroller = []
      events = { startReached: 0, endReached: 0, atEdge: [] }
    },
  }
  window.__driver = driver
}
