import { createRawSnippet, flushSync, mount, tick, unmount, type Snippet } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installLayout, type TestLayout } from '../../react/src/testLayout'
import Headless from './Headless.test.svelte'
import { AnchorList, type AnchorListHandle, type AnchorListProps } from './index'

interface Item {
  id: string
}
const make = (n: number, prefix: string): Item[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))
const getKey = (item: Item): string => item.id

let renders: Record<string, number> = {}
let withoutScroller: string[] = []
/** Counts updates of each row's content: a row updates when its item changes. */
const cell: Snippet<[Item]> = createRawSnippet((item: () => Item) => ({
  render: () => '<span></span>',
  setup(node) {
    $effect(() => {
      const { id } = item()
      renders[id] = (renders[id] ?? 0) + 1
      if (!document.getElementById('sc')) withoutScroller.push(id)
      node.textContent = id
    })
  },
}))
const html = (markup: string): Snippet => createRawSnippet(() => ({ render: () => markup }))

type Props = Partial<AnchorListProps<Item>> & { items: Item[] } & Record<string, unknown>

let layout: TestLayout
let container: HTMLElement
let instance: (AnchorListHandle & Record<string, unknown>) | null = null
// Props are replaced as a whole and never deep-proxied, so items keep their identity like an immutable store.
let current: Props = $state.raw({ items: [] })
const props = new Proxy({} as Props, {
  get: (_, k) => current[k as string],
  has: (_, k) => k in current,
  ownKeys: () => Reflect.ownKeys(current),
  getOwnPropertyDescriptor: (_, k) => (k in current ? { enumerable: true, configurable: true, value: current[k as string] } : undefined),
})
const scroller = (): HTMLElement => document.getElementById('sc')!
const keys = (): string[] => Array.from(scroller().querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key!)
const text = (k: string): string | null | undefined => scroller().querySelector(`[data-key="${k}"]`)?.textContent

/** Mounts once, then replaces the props; resolves after Svelte flushed. */
const render = async (p: Props): Promise<void> => {
  current = { id: 'sc', getKey, children: cell, ...p }
  if (!instance) instance = mount(AnchorList<Item>, { target: container, props: props as AnchorListProps<Item> }) as never
  flushSync()
  await tick()
}
const destroy = (): void => {
  if (instance) unmount(instance)
  instance = null
}

beforeEach(() => {
  layout = installLayout()
  renders = {}
  withoutScroller = []
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  destroy()
  container.remove()
  layout.restore()
  vi.restoreAllMocks()
})

describe('mount', () => {
  it('mounts rows after the scroll container, at the end for align end', async () => {
    await render({ items: make(100, 'i'), align: 'end' })
    expect(withoutScroller).toEqual([])
    expect(keys()).toContain('i99')
    expect(keys().length).toBeLessThan(40)
    const sc = scroller()
    expect(sc.scrollTop).toBe(sc.scrollHeight - sc.clientHeight)
    const last = sc.querySelector('[data-key="i99"]')!
    expect(last.textContent).toBe('i99')
    expect(last.getAttribute('data-index')).toBe('99')
    expect(last.getAttribute('aria-posinset')).toBe('100')
    expect(last.getAttribute('aria-setsize')).toBe('100')
  })

  it('mounts at the start for align start and renders header and footer around the list', async () => {
    await render({ items: make(100, 'i'), header: html('<header>h</header>'), footer: html('<footer>f</footer>') })
    expect(scroller().scrollTop).toBe(0)
    expect(keys()[0]).toBe('i0')
    const content = scroller().querySelector('[role="list"]')!.parentElement!
    expect(Array.from(content.children).map((e) => e.tagName)).toEqual(['HEADER', 'DIV', 'FOOTER'])
  })

  it('passes attributes, not core options, to the scroll container and keeps the spacers', async () => {
    await render({ items: make(100, 'i'), align: 'end', hasMoreStart: true, onStartReached: () => {} })
    const sc = scroller()
    expect(sc.getAttribute('align')).toBeNull()
    expect(sc.getAttribute('hasMoreStart')).toBeNull()
    const list = sc.querySelector<HTMLElement>('[role="list"]')!
    const before = list.style.paddingTop
    expect(parseFloat(before)).toBeGreaterThan(0)
    await render({ items: make(100, 'i'), align: 'end', hasMoreStart: true, class: 'x', style: 'height: 600px', 'aria-label': 'L' })
    expect(sc.className).toBe('x')
    expect(sc.getAttribute('aria-label')).toBe('L')
    expect(sc.style.height).toBe('600px')
    expect(sc.style.overflowAnchor).toBe('none')
    expect(list.style.paddingTop).toBe(before)
  })

  it('treats undefined options and snippets as unset', async () => {
    const unset = { follow: undefined, gap: undefined, overscan: undefined, estimateSize: undefined, header: undefined, sticky: undefined }
    await render({ items: make(100, 'i'), align: 'end', ...unset })
    await render({ items: [...make(100, 'i'), { id: 'n' }], align: 'end', ...unset })
    // Default follow: still pinned to the end after an append.
    expect(keys()).toContain('n')
    expect(instance!.isAtEdge()).toBe(true)
    expect(scroller().querySelector('[role="list"]')!.parentElement!.children.length).toBe(1)
  })

  it('writes the gap in px and the row class', async () => {
    await render({ items: make(10, 'i'), gap: 8, rowClass: 'row' })
    expect(scroller().querySelector<HTMLElement>('[role="list"]')!.style.gap).toBe('8px')
    expect(scroller().querySelector('[data-key="i0"]')!.className).toBe('row')
  })
})

describe('cleanup', () => {
  it('destroys on unmount: removes listeners and disconnects the observer', async () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    await render({ items: make(100, 'i'), align: 'end' })
    const scrolls = (spy: typeof add): number => spy.mock.calls.filter((c) => c[0] === 'scroll').length
    expect(scrolls(add) - scrolls(remove)).toBe(1)
    expect(layout.observers()).toBe(1)
    destroy()
    expect(layout.observers()).toBe(0)
    expect(scrolls(add) - scrolls(remove)).toBe(0)
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['scroll', 'wheel', 'touchstart']))
  })
})

describe('synchronous renders', () => {
  it('renders and commits the new range inside the scroll event', async () => {
    await render({ items: make(100, 'i'), align: 'end' })
    const sc = scroller()
    sc.scrollTop = 0
    sc.dispatchEvent(new Event('scroll'))
    // No flush: the scroll handler rendered and committed synchronously.
    expect(keys()[0]).toBe('i0')
    expect(text('i0')).toBe('i0')
    expect(sc.querySelector('[data-key="i0"]')!.getAttribute('data-index')).toBe('0')
    expect(sc.querySelector<HTMLElement>('[role="list"]')!.style.paddingTop).toBe('0px')
  })
})

describe('key-only rows', () => {
  it('updates no mounted row on a prepend, trim or append', async () => {
    const items = make(100, 'i')
    await render({ items, align: 'end' })
    const mounted = keys()
    renders = {}
    await render({ items: [...make(20, 'p'), ...items.slice(3), ...make(2, 'a')], align: 'end' })
    const kept = keys().filter((k) => mounted.includes(k))
    expect(kept.length).toBeGreaterThan(5)
    for (const k of kept) expect(renders[k] ?? 0, k).toBe(0)
    // The engine re-indexed the mounted rows itself.
    expect(scroller().querySelector('[data-key="i99"]')!.getAttribute('data-index')).toBe('116')
  })

  it('passes the engine a key snapshot of the rendered items when the list shrinks', async () => {
    await render({ items: make(100, 'i'), align: 'end' })
    // The commit reads keys of the old list; a live getKey would read past the new end.
    await render({ items: make(100, 'i').slice(0, 10), align: 'end' })
    expect(keys()).toEqual(make(10, 'i').map(getKey))
    await render({ items: [], align: 'end' })
    expect(keys()).toEqual([])
  })

  it('updates a row when its item changes', async () => {
    const items = make(100, 'i')
    await render({ items })
    renders = {}
    await render({ items: [{ id: 'i0' }, ...items.slice(1)] })
    expect(renders).toEqual({ i0: 1 })
  })
})

describe('handle', () => {
  it('scrolls to keys and edges and reports the state', async () => {
    await render({ items: make(500, 'i'), align: 'end' })
    const hd = instance!
    expect(hd.isAtEdge()).toBe(true)
    expect(hd.indexOf('i10')).toBe(10)
    expect(hd.scrollToKey('nope')).toBe(false)
    expect(hd.scrollToKey('i10')).toBe(true)
    await tick()
    await tick()
    expect(keys()).toContain('i10')
    const top = (k: string): number => scroller().querySelector(`[data-key="${k}"]`)!.getBoundingClientRect().top
    expect(top('i10')).toBe(0)
    expect(hd.isAtEdge()).toBe(false)
    expect(hd.getItemRect('i10')).toMatchObject({ start: scroller().scrollTop, size: 50, measured: true })
    hd.scrollToEdge()
    await tick()
    expect(hd.isAtEdge()).toBe(true)
    expect(hd.getSnapshot().pinned).toBe(true)
    expect(hd.getTotalSize()).toBeGreaterThanOrEqual(500 * 48)
    expect(hd.getTotalSize()).toBeLessThanOrEqual(500 * 50)
    expect(hd.scrollToIndex(250, { align: 'center' })).toBe(true)
    await tick()
    expect(top('i250') + 25).toBe(300)
    expect(hd.getVisibleRange().startKey).toBe('i244')
    expect(typeof hd.subscribe(() => {})).toBe('function')
  })

  it('renders the sticky snippet from the visible range', async () => {
    const sticky = createRawSnippet((range: () => { startKey: string | number | null }) => ({
      render: () => '<span data-testid="pill"></span>',
      setup(node) {
        $effect(() => void (node.textContent = String(range().startKey)))
      },
    }))
    await render({ items: make(100, 'i'), sticky })
    const pill = (): string | null | undefined => document.querySelector('[data-testid="pill"]')?.textContent
    expect(pill()).toBe('i0')
    instance!.scrollToKey('i40')
    await tick()
    await tick()
    expect(pill()).toBe('i40')
    expect(instance!.getVisibleRange()).toMatchObject({ startKey: 'i40', endKey: 'i51' })
  })

  it('restores an initial snapshot on mount', async () => {
    await render({ items: make(300, 'i'), align: 'end' })
    instance!.scrollToKey('i100')
    await tick()
    await tick()
    const snapshot = instance!.getSnapshot()
    destroy()
    await render({ items: make(300, 'i'), align: 'end', initialSnapshot: snapshot })
    expect(scroller().querySelector('[data-key="i100"]')!.getBoundingClientRect().top).toBe(0)
  })
})

describe('createAnchorList', () => {
  it('drives custom markup', async () => {
    const app = mount(Headless, { target: container, props: { items: Array.from({ length: 100 }, (_, i) => `h${i}`) } })
    flushSync()
    await tick()
    expect(keys()).toContain('h99')
    expect(scroller().scrollTop).toBe(scroller().scrollHeight - 600)
    unmount(app)
  })

  it('pairs rows with keys by data-key, ignoring other children of the list', async () => {
    const app = mount(Headless, { target: container, props: { items: Array.from({ length: 100 }, (_, i) => `h${i}`), spinner: true } })
    flushSync()
    await tick()
    expect(document.querySelector('.spinner')!.hasAttribute('data-index')).toBe(false)
    expect(scroller().querySelector('[data-key="h99"]')!.getAttribute('data-index')).toBe('99')
    unmount(app)
  })
})
