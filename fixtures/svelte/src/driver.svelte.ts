import { elementScroller, HORIZONTAL } from '@anchorlist/core'
import { animateToKey } from '@anchorlist/core/animate'
import { grid, masonry } from '@anchorlist/core/lanes'
import { rtlScroller } from '@anchorlist/core/rtl'
import { takeSnapshot } from '@anchorlist/core/snapshot'
import { windowScroller } from '@anchorlist/core/window'
import type { AnchorListHandle } from '@anchorlist/svelte'
import { flushSync, hydrate, mount, unmount } from 'svelte'
import { version } from 'svelte/package.json'
import { createDom } from '../../../scenarios/src/dom'
import type { Driver, Item, MountConfig } from '../../../scenarios/src/driver'
import App from './App.svelte'
import type * as Ssr from './ssr'
import { DEFAULTS, store } from './store.svelte'

/**
 * Items arrive as fresh copies through each `page.evaluate`. Interning them by
 * id (when unchanged) keeps object identity like an immutable app store does,
 * so rows can skip updates. Only the current items are kept: trimmed ids are
 * dropped, so the fixture does not grow the heap over long runs.
 */
let interned = new Map<string, Item>()
const intern = (items: Item[]): Item[] => {
  const next = new Map<string, Item>()
  const out = items.map((m) => {
    const prev = interned.get(m.id)
    const item = prev && prev.height === m.height && prev.text === m.text && prev.mine === m.mine && prev.header === m.header ? prev : m
    next.set(m.id, item)
    return item
  })
  interned = next
  return out
}

export function installDriver(container: HTMLElement): void {
  let app: ReturnType<typeof mount> | null = null
  const dom = createDom('scroller')
  const handle = (): AnchorListHandle => {
    if (!store.list) throw new Error('list not mounted')
    return store.list
  }

  /** Resets the per-mount state for `config`. */
  const prepare = (config: MountConfig): void => {
    if (app) unmount(app)
    app = null
    store.heights.clear()
    driver.resetCounters()
    interned.clear()
    // Svelte has no strict mode: `config.strict` is ignored.
    store.config = config
    store.state = { ...DEFAULTS, ...config, items: intern(config.items) }
    store.horizontal = config.layout === 'horizontal' || config.layout === 'rtl'
    const l = config.lanes
    store.lanes = l && (l.kind === 'grid' ? grid : masonry)({ lanes: l.lanes, gap: l.gap ?? 0, horizontal: store.horizontal })
  }

  let lastUpdateMs = 0

  const driver: Driver = {
    ...dom,
    async mount(config) {
      prepare(config)
      app = mount(App, { target: container })
      await dom.frames(2)
    },
    async unmount() {
      if (app) unmount(app)
      app = null
      store.list = undefined
      await dom.frames(1)
    },
    async update(patch) {
      // Both modes are rendered and committed before this returns (Svelte has no transitions of state).
      if (patch.items) patch = { ...patch, items: intern(patch.items) }
      // Timed from here: the render and commit, not the interning above.
      const t = performance.now()
      store.state = { ...store.state, ...patch }
      flushSync()
      lastUpdateMs = performance.now() - t
    },
    setItemHeight(id, height) {
      store.heights.set(id, height)
      flushSync()
    },
    scrollToKey: (key, o) => handle().scrollToKey(key, o),
    scrollToIndex: (i, o) => handle().scrollToIndex(i, o),
    scrollToEdge: (edge) => handle().scrollToEdge(edge),
    isAtEdge: (edge) => handle().isAtEdge(edge),
    getSnapshot: () => handle().getSnapshot(),
    getVisibleRange: () => handle().getVisibleRange(),
    getItemRect: (key) => handle().getItemRect(key),
    events: () => ({ ...store.events, atEdge: [...store.events.atEdge] }),
    renders: () => ({ ...store.renders }),
    rendersWithoutScroller: () => [...store.withoutScroller],
    frameworkVersion: () => version,
    lastUpdateMs: () => lastUpdateMs,
    animateToKey(key, o) {
      const element = handle().getElement()
      const { layout, scrollMargin } = store.config
      // The scroller animateToKey reads and writes the offset through, per layout.
      const scroller =
        layout === 'window'
          ? windowScroller({ list: element, scrollMargin: scrollMargin ?? 0 })
          : layout === 'rtl'
            ? rtlScroller({ element, list: element })
            : layout === 'horizontal'
              ? elementScroller({ element, list: element, axis: HORIZONTAL })
              : undefined
      return animateToKey(handle(), element, key, { ...o, ...(scroller && { scroller }) })
    },
    takeSnapshot() {
      const { items } = store.state
      return takeSnapshot(handle(), (i) => items[i]!.id, items.length)
    },
    async serverRender(config) {
      prepare(config)
      // The same app compiled for the server (`src/ssr.ts`, built into `ssr/`), as on a server.
      const ssr = (await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}ssr/ssr.js`)) as typeof Ssr
      const r = ssr.renderList(config, store.state)
      store.renders = r.renders
      store.withoutScroller = r.withoutScroller
      container.innerHTML = r.html
      return Array.from(container.querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key ?? '')
    },
    async hydrate() {
      app = hydrate(App, { target: container })
      await dom.frames(2)
    },
    resetCounters() {
      store.renders = {}
      store.withoutScroller = []
      store.events = { startReached: 0, endReached: 0, atEdge: [] }
    },
  }
  window.__driver = driver
}
