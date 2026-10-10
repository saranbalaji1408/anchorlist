import type { AnchorListHandle } from '@anchorlist/svelte'
import { flushSync, mount, unmount } from 'svelte'
import { version } from 'svelte/package.json'
import { createDom } from '../../../scenarios/src/dom'
import type { Driver, Item } from '../../../scenarios/src/driver'
import App from './App.svelte'
import { DEFAULTS, store } from './store.svelte'

/**
 * Items arrive as fresh copies through each `page.evaluate`. Interning them by
 * id (when unchanged) keeps object identity like an immutable app store does,
 * so rows can skip updates.
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
  let app: ReturnType<typeof mount> | null = null
  const dom = createDom('scroller')
  const handle = (): AnchorListHandle => {
    if (!store.list) throw new Error('list not mounted')
    return store.list
  }

  const driver: Driver = {
    ...dom,
    async mount(config) {
      if (app) unmount(app)
      store.heights.clear()
      driver.resetCounters()
      interned.clear()
      // Svelte has no strict mode: `config.strict` is ignored.
      store.config = config
      store.state = { ...DEFAULTS, ...config, items: intern(config.items) }
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
      store.state = { ...store.state, ...patch }
      flushSync()
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
    resetCounters() {
      store.renders = {}
      store.withoutScroller = []
      store.events = { startReached: 0, endReached: 0, atEdge: [] }
    },
  }
  window.__driver = driver
}
