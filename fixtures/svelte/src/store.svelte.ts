import type { AnchorListHandle } from '@anchorlist/svelte'
import { SvelteMap } from 'svelte/reactivity'
import type { Events, ListState, MountConfig } from '../../../scenarios/src/driver'

export const DEFAULTS: ListState = {
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

/** Fixture state shared by the driver and the app. */
class Store {
  /** Replaced as a whole and never deep-proxied, so items keep their identity like an immutable store. */
  state: ListState = $state.raw(DEFAULTS)
  config: MountConfig = { items: [] }
  heights: SvelteMap<string, number> = new SvelteMap()
  list: AnchorListHandle | undefined = undefined
  renders: Record<string, number> = {}
  withoutScroller: string[] = []
  events: Events = { startReached: 0, endReached: 0, atEdge: [] }
}

export const store: Store = new Store()
