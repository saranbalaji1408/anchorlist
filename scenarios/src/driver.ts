/**
 * The framework-neutral contract between scenarios and fixtures. Every fixture
 * (`fixtures/*`) exposes a {@link Driver} as `window.__driver`. Scenarios only
 * talk to the driver; they never import framework code.
 *
 * The rendered DOM must follow the anchorlist structure: a scroll container
 * with `id="scroller"`, rows with `data-key`, and an optional sticky overlay
 * containing `[data-testid="pill"]`.
 */

import type { Dom } from './dom'

/** A list item. Rows render `text` (or the id) in a box of `height` px (auto when omitted). */
export interface Item {
  id: string
  height?: number
  text?: string
  /** "Sent by the user": with `followMine`, adding such an item at the pinned edge forces follow. */
  mine?: boolean
}

/** Serializable scroll position (mirrors the core `Snapshot`). */
export interface SnapshotData {
  key: string | number | null
  index: number
  delta: number
  pinned: boolean
}

/** Props that can change after mount. */
export interface ListState {
  items: Item[]
  align: 'start' | 'end'
  /** Viewport height in px. Default 600. */
  height: number
  /** Viewport width in px. Default 400. */
  width: number
  /** Header height in px, or null for no header. */
  header: number | null
  /** Footer height in px, or null for no footer. */
  footer: number | null
  /** Render the sticky overlay (`[data-testid="pill"]` showing the first visible key). */
  sticky: boolean
  /** Fixed size estimate in px (omit for the engine default). */
  estimate: number | null
  overscan: number | null
  gap: number
  paddingStart: number
  paddingEnd: number
  hasMoreStart: boolean
  hasMoreEnd: boolean
  /** Follow (jump to the pinned edge) when an added item has `mine: true`. */
  followMine: boolean
}

/** Mount-time options. */
export interface MountConfig extends Partial<ListState> {
  items: Item[]
  /** Wrap the list in the framework's strict / dev checking mode (React StrictMode). */
  strict?: boolean
  initialSnapshot?: SnapshotData
}

/** How a state update is applied. */
export type UpdateMode =
  /** Rendered and committed before `update` returns (React `flushSync`). */
  | 'sync'
  /** A low-priority, interruptible update (React `startTransition`). Resolves once committed. */
  | 'transition'

/** Callback counters recorded by the fixture. */
export interface Events {
  startReached: number
  endReached: number
  /** Every `onAtEdgeChange` value, in order. */
  atEdge: boolean[]
}

/** The scenario driver exposed by each fixture as `window.__driver`. */
export interface Driver extends Dom {
  /** Unmounts any previous list and mounts a new one. Resolves after 2 frames. */
  mount(config: MountConfig): Promise<void>
  unmount(): Promise<void>
  /** Changes props. */
  update(patch: Partial<ListState>, mode?: UpdateMode): Promise<void>
  /** Sets the rendered height of one item's content, committed synchronously. */
  setItemHeight(id: string, height: number): void
  scrollToKey(key: string, options?: { align?: 'start' | 'center' | 'end'; offset?: number }): boolean
  scrollToIndex(index: number, options?: { align?: 'start' | 'center' | 'end'; offset?: number }): boolean
  scrollToEdge(edge?: 'start' | 'end'): void
  isAtEdge(edge?: 'start' | 'end'): boolean
  getSnapshot(): SnapshotData
  getVisibleRange(): { startIndex: number; endIndex: number; startKey: string | number | null; endKey: string | number | null }
  getItemRect(key: string): { start: number; size: number; measured: boolean } | null
  events(): Events
  /** Row content renders per item id since the last reset. */
  renders(): Record<string, number>
  /** Ids of rows whose content rendered while the scroll container was not in the document. */
  rendersWithoutScroller(): string[]
  resetCounters(): void
  /** Version of the framework the fixture runs on (for example React `18.3.1`). */
  frameworkVersion(): string
}

declare global {
  interface Window {
    __driver: Driver
  }
}
