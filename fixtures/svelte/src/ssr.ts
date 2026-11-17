import { grid, masonry } from '@anchorlist/core/lanes'
import { render } from 'svelte/server'
import type { ListState, MountConfig } from '../../../scenarios/src/driver'
import App from './App.svelte'
import { store } from './store.svelte'

/**
 * Server-renders the fixture app for `config` and `state` and returns its
 * HTML. Built for the server into `ssr/` (see `vite.config.ts`) and loaded by
 * the driver, so the list is compiled and rendered exactly as on a server.
 * Also returns the row content renders of the server render (this build has
 * its own copy of the store).
 */
export function renderList(config: MountConfig, state: ListState): { html: string; renders: Record<string, number>; withoutScroller: string[] } {
  store.server = true
  store.renders = {}
  store.withoutScroller = []
  store.config = config
  store.state = state
  store.horizontal = config.layout === 'horizontal' || config.layout === 'rtl'
  const l = config.lanes
  store.lanes = l && (l.kind === 'grid' ? grid : masonry)({ lanes: l.lanes, gap: l.gap ?? 0, horizontal: store.horizontal })
  const html = render(App).body
  return { html, renders: store.renders, withoutScroller: store.withoutScroller }
}
