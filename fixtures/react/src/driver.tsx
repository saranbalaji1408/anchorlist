import { AnchorList, type AnchorListHandle, type AnchorListProps, type FollowContext, type VisibleRange } from 'anchorlist'
import { animateToKey } from 'anchorlist/animate'
import { rtlScroller } from 'anchorlist/rtl'
import { snapshotEstimate, takeSnapshot } from 'anchorlist/snapshot'
import { initialPlan } from 'anchorlist/ssr'
import { StickyItem } from 'anchorlist/sticky'
import { windowScroller } from 'anchorlist/window'
import { StrictMode, startTransition, useLayoutEffect, useState, useSyncExternalStore, version, type ReactNode, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server.browser'
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
/** Rows run along the horizontal axis: item heights are widths. Set on mount. */
let horizontal = false

function Bubble({ item }: { item: Item }): ReactNode {
  const read = (): number | undefined => heights.get(item.id) ?? item.height
  const height = useSyncExternalStore(subscribeHeights, read, read)
  renders[item.id] = (renders[item.id] ?? 0) + 1
  if (!document.getElementById(SCROLLER_ID)) withoutScroller.push(item.id)
  return (
    <div
      style={
        horizontal
          ? { width: height, height: '100%', boxSizing: 'border-box', borderInlineEnd: '1px solid #ccc', overflow: 'hidden', background: item.header ? '#ffd' : '#fff' }
          : { height, boxSizing: 'border-box', borderBottom: '1px solid #ccc', overflowWrap: 'anywhere', background: item.header ? '#ffd' : '#fff' }
      }
    >
      {item.text ?? item.id}
    </div>
  )
}

// Module scope: a stable renderItem lets memoised rows skip re-renders.
const renderItem = (item: Item): ReactNode => <Bubble item={item} />
const getKey = (item: Item): string => item.id
const pill = (range: { startKey: string | number | null }): ReactNode => <div data-testid="pill">{range.startKey}</div>
const isHeader = (item: Item): boolean => !!item.header
const renderStuck = (item: Item): ReactNode => (
  <div data-testid="stuck">
    <Bubble item={item} />
  </div>
)

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

interface Bridge {
  set: (update: (s: ListState) => ListState) => void
  committed: () => void
}

function App({ init, config, bridge, list }: { init: ListState; config: MountConfig; bridge: Bridge; list: RefObject<AnchorListHandle | null> }): ReactNode {
  const [s, set] = useState(init)
  bridge.set = set
  const { items, align } = s
  current = items
  const layout = config.layout ?? 'vertical'
  const margin = config.scrollMargin ?? 0
  // Header and footer sizes are along the main axis.
  const size = horizontal ? 'width' : 'height'
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
    busy: s.busy,
    ...callbacks,
    style: { height: s.height, width: s.width, border: 'none' },
    scrollerProps: { id: SCROLLER_ID },
    header: s.header === null ? null : <div style={{ [size]: s.header, background: '#eef' }}>header</div>,
    footer: s.footer === null ? null : <div style={{ [size]: s.footer, background: '#efe' }}>footer</div>,
    ...(s.sticky ? { sticky: pill } : {}),
    ...(s.stickyItems
      ? { sticky: (range: VisibleRange) => <StickyItem range={range} items={items} isSticky={isHeader} renderItem={renderStuck} /> }
      : {}),
    ...(s.estimate === null ? {} : { estimateSize: () => s.estimate! }),
    ...(s.overscan === null ? {} : { overscan: s.overscan }),
    ...(s.followMine ? { follow } : {}),
    ...(config.initialSnapshot ? { initialSnapshot: config.initialSnapshot } : {}),
    ...(config.initialSnapshot?.sizes
      ? { estimateSize: snapshotEstimate(config.initialSnapshot, (i) => items[i]!.id, s.estimate === null ? undefined : () => s.estimate!) }
      : {}),
    ...(config.initialRect ? { initialRect: config.initialRect, initialPlan } : {}),
    ...(horizontal ? { horizontal } : {}),
    ...(layout === 'rtl'
      ? { scroller: rtlScroller, style: { height: s.height, width: s.width, overflowX: 'auto' }, scrollerProps: { id: SCROLLER_ID, dir: 'rtl' } }
      : {}),
    // The page scrolls: the container has no height, and a fixed bar covers the top `margin` px.
    ...(layout === 'window' ? { scroller: (e) => windowScroller({ ...e, scrollMargin: margin }), style: { width: s.width } } : {}),
  }
  return (
    <main style={layout === 'window' ? { paddingTop: margin } : undefined}>
      {layout === 'window' && margin > 0 && (
        <div id="appbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: margin, background: '#fde', zIndex: 2 }} />
      )}
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
 * so memoised rows can skip re-rendering. Only the current items are kept (and
 * only their render counts), so trimmed ones are released like in an app.
 */
let interned = new Map<string, Item>()
/** The items of the last render. */
let current: Item[] = []
const intern = (items: Item[]): Item[] => {
  const next = new Map<string, Item>()
  const out = items.map((m) => {
    const prev = interned.get(m.id)
    const item = prev && prev.height === m.height && prev.text === m.text && prev.mine === m.mine && prev.header === m.header ? prev : m
    next.set(m.id, item)
    return item
  })
  interned = next
  // Render counts of removed items go too: the counter is per item, like the intern table.
  for (const id in renders) if (!next.has(id)) delete renders[id]
  return out
}

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

  /** The app element for `config`, after resetting the per-mount state. */
  const prepare = (config: MountConfig): ReactNode => {
    root?.unmount()
    root = null
    heights.clear()
    driver.resetCounters()
    interned.clear()
    const init: ListState = { ...DEFAULTS, ...config, items: intern(config.items) }
    horizontal = config.layout === 'horizontal' || config.layout === 'rtl'
    const app = <App init={init} config={config} bridge={bridge} list={list} />
    return config.strict ? <StrictMode>{app}</StrictMode> : app
  }
  let server: ReactNode = null
  let lastUpdateMs = 0

  const driver: Driver = {
    ...dom,
    async mount(config) {
      const app = prepare(config)
      root = createRoot(container)
      root.render(app)
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
      if (mode === 'sync') {
        const t = performance.now()
        flushSync(() => bridge.set(apply))
        lastUpdateMs = performance.now() - t
        return
      }
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
    frameworkVersion: () => version,
    lastUpdateMs: () => lastUpdateMs,
    animateToKey: (key, o) => animateToKey(handle(), handle().element, key, o),
    takeSnapshot() {
      const items = current
      return takeSnapshot(handle(), (i) => items[i]!.id, items.length)
    },
    async serverRender(config) {
      server = prepare(config)
      // A real server has no DOM, where the adapter uses no layout effects. In
      // this browser-run render React 18 warns about them; that is not an error here.
      const error = console.error
      console.error = (...args: unknown[]) => void (/useLayoutEffect does nothing on the server/.test(String(args[0])) || error(...args))
      try {
        container.innerHTML = renderToString(server)
      } finally {
        console.error = error
      }
      return Array.from(container.querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key ?? '')
    },
    async hydrate() {
      root = hydrateRoot(container, server, {
        onRecoverableError: (e) => console.error('recoverable hydration error', e),
      })
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
