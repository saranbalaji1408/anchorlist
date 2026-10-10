import { useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { makeItems, rng, type Item } from './data'
import { LISTS, renders, type Lib } from './lists'

/** What the runner drives in the page (`window.__bench`). */
export interface Bench {
  lib: Lib
  /**
   * Mounts `count` items, then waits `frames` more frames. Returns the time
   * until the list first showed the newest item at the bottom (and stayed for
   * 3 frames), or NaN.
   */
  mount(count: number, seed: number, frames?: number): Promise<number>
  /** Prepends `n` new items synchronously. Returns the commit time in ms (render, commit, layout effects). */
  prepend(n: number): number
  /** Appends `n` new items synchronously. Returns the commit time in ms. */
  append(n: number): number
  /** Grows item `id` by `px` synchronously. Returns the commit time in ms. */
  grow(id: string, px: number): number
  /** Moves the scroll offset by `delta` like a user scroll. */
  scrollBy(delta: number): void
  /** Top and bottom of the row `id` relative to the scroll container's top, or null when not mounted. */
  rect(id: string): { top: number; bottom: number } | null
  /** Ids of mounted rows in DOM order. */
  keys(): string[]
  /** Distance in px from the bottom of the scroll range. */
  fromBottom(): number
  /** Row content renders by id since the last call. */
  takeRenders(): Record<string, number>
  /** Resolves after `n` animation frames. */
  frames(n: number): Promise<void>
  /** Samples `rect(id).top` every frame until {@link stopSampler} (NaN while unmounted). */
  startSampler(id: string): void
  stopSampler(): number[]
  /** Scrolls by `delta` px every frame for `n` frames. Returns the frame intervals in ms. */
  scrollFrames(delta: number, n: number): Promise<number[]>
}

declare global {
  interface Window {
    __bench: Bench
  }
}

const lib = (new URLSearchParams(location.search).get('lib') ?? 'anchorlist') as Lib
const List = LISTS[lib]
let scroller: HTMLElement | null = null
let set: (f: (s: State) => State) => void = () => {}
let random = rng(1)
let batch = 0

interface State {
  items: Item[]
  prepended: number
}

function App({ init }: { init: State }): ReactNode {
  const [s, setState] = useState(init)
  set = setState
  return <List items={s.items} prepended={s.prepended} onScroller={(el) => (scroller = el)} />
}

const frame = (): Promise<number> => new Promise((r) => requestAnimationFrame(r))
const sc = (): HTMLElement => scroller!
/** Runs a state update synchronously and forces layout; returns the elapsed time. */
const timed = (f: (s: State) => State): number => {
  const t = performance.now()
  flushSync(() => set(f))
  void sc().scrollTop
  return performance.now() - t
}
let samples: number[] = []
let sampling = false

window.__bench = {
  lib,
  async mount(count, seed, frames = 10) {
    random = rng(seed)
    const t = performance.now()
    createRoot(document.getElementById('root')!).render(<App init={{ items: makeItems(count, 'm', random), prepended: 0 }} />)
    // Settled: pinned to the bottom for 3 consecutive frames (at most 120 frames).
    let ms = Number.NaN
    for (let i = 0, pinned = 0; i < 120 && pinned < 3; i++) {
      await frame()
      if (scroller && this.fromBottom() <= 1) {
        if (!pinned++) ms = performance.now() - t
      } else pinned = 0
    }
    await this.frames(frames)
    return ms
  },
  prepend(n) {
    const add = makeItems(n, `p${batch++}-`, random)
    return timed((s) => ({ items: [...add, ...s.items], prepended: s.prepended + n }))
  },
  append(n) {
    const add = makeItems(n, `a${batch++}-`, random)
    return timed((s) => ({ ...s, items: [...s.items, ...add] }))
  },
  grow(id, px) {
    return timed((s) => ({ ...s, items: s.items.map((m) => (m.id === id ? { ...m, height: m.height + px } : m)) }))
  },
  scrollBy(delta) {
    sc().scrollTop += delta
  },
  rect(id) {
    const el = sc().querySelector(`[data-key="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const top = sc().getBoundingClientRect().top
    return { top: r.top - top, bottom: r.bottom - top }
  },
  keys: () => Array.from(sc().querySelectorAll<HTMLElement>('[data-key]'), (e) => e.dataset.key!),
  fromBottom: () => sc().scrollHeight - sc().scrollTop - sc().clientHeight,
  takeRenders() {
    const r = Object.fromEntries(renders)
    renders.clear()
    return r
  },
  async frames(n) {
    // A full frame: rendering steps included (a timeout after the animation frame).
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
  },
  startSampler(id) {
    samples = []
    sampling = true
    // One sample per painted frame, after the pre-paint ResizeObserver corrections of every list
    // (observers run in creation order, and this one is created last): a probe element is resized
    // from requestAnimationFrame and the sample is taken in its ResizeObserver callback.
    const probe = document.body.appendChild(document.createElement('div'))
    probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none'
    const ro = new ResizeObserver(() => {
      if (sampling) samples.push(this.rect(id)?.top ?? Number.NaN)
    })
    ro.observe(probe)
    let flip = false
    const tick = (): void => {
      if (!sampling) {
        ro.disconnect()
        probe.remove()
        return
      }
      flip = !flip
      probe.style.height = flip ? '2px' : '1px'
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  },
  stopSampler() {
    sampling = false
    return samples
  },
  async scrollFrames(delta, n) {
    const times: number[] = [await frame()]
    for (let i = 0; i < n; i++) {
      sc().scrollTop += delta
      times.push(await frame())
    }
    return times.slice(1).map((t, i) => t - times[i]!)
  },
}
