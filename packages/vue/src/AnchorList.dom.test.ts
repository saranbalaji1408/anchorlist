// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, shallowRef, version, type App, type VNodeChild } from 'vue'
import { installLayout, type TestLayout } from '../../react/src/testLayout'
import { AnchorList, type AnchorListHandle, type AnchorListProps, useAnchorList } from './index'

interface Item {
  id: string
}
const make = (n: number, prefix: string): Item[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))

let renders: Record<string, number> = {}
let withoutScroller: string[] = []
const Cell = defineComponent({
  props: ['item'],
  setup(p) {
    return () => {
      const id = (p.item as Item).id
      renders[id] = (renders[id] ?? 0) + 1
      if (!document.getElementById('sc')) withoutScroller.push(id)
      return id
    }
  },
})
const getKey = (item: Item): string => item.id

type Props = Partial<AnchorListProps<Item>> & { items: Item[] }
type Slots = Record<string, (arg: never) => VNodeChild>

let layout: TestLayout
let container: HTMLElement
let app: App | null
const props = shallowRef<Props>({ items: [] })
const slots = shallowRef<Slots>({})
const handle = shallowRef<AnchorListHandle | null>(null)
const scroller = (): HTMLElement => document.getElementById('sc')!
const keys = (): string[] => Array.from(scroller().querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key!)
const defaultSlot = ({ item }: { item: Item }): VNodeChild => h(Cell, { item })

/** Mounts once, then updates props and slots; resolves after Vue flushed. */
const render = async (p: Props, s: Slots = {}): Promise<void> => {
  props.value = p
  slots.value = { default: defaultSlot as Slots[string], ...s }
  if (!app) {
    app = createApp({
      render: () =>
        h(AnchorList as never, { ref: (r: unknown) => (handle.value = r as AnchorListHandle), id: 'sc', getKey, ...props.value }, slots.value),
    })
    app.mount(container)
  }
  await nextTick()
  await nextTick()
}
const unmount = (): void => {
  app?.unmount()
  app = null
}

beforeEach(() => {
  layout = installLayout()
  renders = {}
  withoutScroller = []
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  unmount()
  container.remove()
  layout.restore()
  vi.restoreAllMocks()
})

it('runs on the Vue minor under test', () => {
  // `pnpm test:vue33` runs this file against Vue 3.3; `pnpm test` against the latest.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  if (env?.EXPECT_VUE_MINOR) expect(version.startsWith(`${env.EXPECT_VUE_MINOR}.`)).toBe(true)
  else expect(version.startsWith('3.')).toBe(true)
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
    expect(last.getAttribute('data-index')).toBe('99')
    expect(last.getAttribute('aria-posinset')).toBe('100')
    expect(last.getAttribute('aria-setsize')).toBe('100')
  })

  it('mounts at the start for align start and renders header and footer around the list', async () => {
    await render({ items: make(100, 'i') }, { header: () => h('header', 'h'), footer: () => h('footer', 'f') })
    expect(scroller().scrollTop).toBe(0)
    expect(keys()[0]).toBe('i0')
    const content = scroller().querySelector('[role="list"]')!.parentElement!
    expect(Array.from(content.children).map((e) => e.tagName)).toEqual(['HEADER', 'DIV', 'FOOTER'])
  })

  it('passes attributes to the scroll container and keeps the spacers across re-renders', async () => {
    await render({ items: make(100, 'i'), align: 'end', gap: 0 })
    const list = scroller().querySelector<HTMLElement>('[role="list"]')!
    const before = list.style.paddingTop
    expect(parseFloat(before)).toBeGreaterThan(0)
    await render({ items: make(100, 'i'), align: 'end', class: 'x', style: { height: '600px' } } as Props)
    expect(scroller().className).toBe('x')
    expect(scroller().style.height).toBe('600px')
    expect(scroller().style.overflowAnchor).toBe('none')
    expect(list.style.paddingTop).toBe(before)
  })

  it('writes the gap in px and the row class', async () => {
    await render({ items: make(10, 'i'), gap: 8, rowClass: 'row' })
    expect(scroller().querySelector<HTMLElement>('[role="list"]')!.style.gap).toBe('8px')
    expect(scroller().querySelector('[data-key="i0"]')!.className).toBe('row')
  })

  it('casts boolean props from attribute syntax and leaves follow unset', async () => {
    const reached = vi.fn()
    // `<AnchorList has-more-start>` passes an empty string.
    await render({ items: make(100, 'i'), align: 'end', hasMoreStart: '' as never, onStartReached: reached })
    expect(scroller().querySelector('[data-key="i99"]')!.getAttribute('aria-setsize')).toBe('-1')
    await render({ items: [...make(100, 'i'), { id: 'n' }], align: 'end', hasMoreStart: '' as never, onStartReached: reached })
    // Default follow: still pinned to the end after an append.
    expect(keys()).toContain('n')
    expect(handle.value!.isAtEdge()).toBe(true)
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
    unmount()
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
    // No await: the scroll handler rendered and committed synchronously.
    expect(keys()[0]).toBe('i0')
    expect(sc.querySelector('[data-key="i0"]')!.getAttribute('data-index')).toBe('0')
    expect(sc.querySelector<HTMLElement>('[role="list"]')!.style.paddingTop).toBe('0px')
    await nextTick()
    expect(keys()[0]).toBe('i0')
  })
})

describe('key-only rows', () => {
  it('re-renders no mounted row on a prepend, trim or append', async () => {
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

  it('re-renders a row when its item changes', async () => {
    const items = make(100, 'i')
    await render({ items })
    renders = {}
    await render({ items: [{ id: 'i0' }, ...items.slice(1)] })
    expect(renders).toEqual({ i0: 1 })
  })

  it('re-renders rows when reactive state read in the slot changes', async () => {
    const label = shallowRef('a')
    await render({ items: make(10, 'i') }, { default: (({ item }: { item: Item }) => `${item.id}${label.value}`) as Slots[string] })
    expect(scroller().querySelector('[data-key="i0"]')!.textContent).toBe('i0a')
    label.value = 'b'
    await nextTick()
    expect(scroller().querySelector('[data-key="i0"]')!.textContent).toBe('i0b')
  })
})

describe('imperative handle', () => {
  it('scrolls to keys and edges and reports the state', async () => {
    await render({ items: make(500, 'i'), align: 'end' })
    const hd = handle.value!
    expect(hd.isAtEdge()).toBe(true)
    expect(hd.indexOf('i10')).toBe(10)
    expect(hd.scrollToKey('nope')).toBe(false)
    expect(hd.scrollToKey('i10')).toBe(true)
    await nextTick()
    await nextTick()
    expect(keys()).toContain('i10')
    const top = (k: string): number => scroller().querySelector(`[data-key="${k}"]`)!.getBoundingClientRect().top
    expect(top('i10')).toBe(0)
    expect(hd.isAtEdge()).toBe(false)
    expect(hd.getItemRect('i10')).toMatchObject({ start: scroller().scrollTop, size: 50, measured: true })
    hd.scrollToEdge()
    await nextTick()
    expect(hd.isAtEdge()).toBe(true)
    expect(hd.getSnapshot().pinned).toBe(true)
    expect(hd.getTotalSize()).toBeGreaterThanOrEqual(500 * 48)
    expect(hd.getTotalSize()).toBeLessThanOrEqual(500 * 50)
    expect(hd.scrollToIndex(250, { align: 'center' })).toBe(true)
    await nextTick()
    expect(top('i250') + 25).toBe(300)
  })

  it('renders the sticky slot from the visible range', async () => {
    await render({ items: make(100, 'i') }, { sticky: ((r: { startKey: string | null }) => h('span', { 'data-testid': 'pill' }, String(r.startKey))) as Slots[string] })
    const pill = (): string | null | undefined => document.querySelector('[data-testid="pill"]')?.textContent
    expect(pill()).toBe('i0')
    handle.value!.scrollToKey('i40')
    await nextTick()
    await nextTick()
    expect(pill()).toBe('i40')
    expect(handle.value!.getVisibleRange()).toMatchObject({ startKey: 'i40', endKey: 'i51' })
  })

  it('restores an initial snapshot on mount', async () => {
    await render({ items: make(300, 'i'), align: 'end' })
    handle.value!.scrollToKey('i100')
    await nextTick()
    await nextTick()
    const snapshot = handle.value!.getSnapshot()
    unmount()
    await render({ items: make(300, 'i'), align: 'end', initialSnapshot: snapshot })
    expect(scroller().querySelector('[data-key="i100"]')!.getBoundingClientRect().top).toBe(0)
  })
})

describe('useAnchorList', () => {
  it('drives custom markup', async () => {
    const items = make(100, 'h')
    const Custom = defineComponent({
      setup() {
        let element: HTMLElement | undefined
        let list: HTMLElement
        const [v, plan] = useAnchorList(
          () => ({ count: items.length, getKey: (i) => items[i]!.id, align: 'end' }),
          () => element && { element, list },
        )
        return () => {
          const p = plan()
          const rows = []
          for (let i = p.start; i <= p.end; i++) {
            const k = items[i]!.id
            rows.push(h('div', { key: k, 'data-key': k, ref: (el: unknown) => v.measureElement(el, k) }, k))
          }
          return h('div', { id: 'sc', ref: (e: unknown) => (element = e as HTMLElement), style: 'overflow-anchor: none' }, [
            h('div', { role: 'list', ref: (e: unknown) => (list = e as HTMLElement) }, rows),
          ])
        }
      },
    })
    app = createApp(Custom)
    app.mount(container)
    await nextTick()
    await nextTick()
    expect(keys()).toContain('h99')
    expect(scroller().scrollTop).toBe(scroller().scrollHeight - 600)
  })
})
