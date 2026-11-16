// @vitest-environment happy-dom
import { elementScroller, HORIZONTAL, type ElementScrollerOptions } from '@anchorlist/core'
import { grid } from '@anchorlist/core/lanes'
import { initialPlan } from '@anchorlist/core/ssr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createSSRApp, h, nextTick, shallowRef, type App, type VNodeChild } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { installLayout, type TestLayout } from '../../react/src/testLayout'
import { horizontal } from './horizontal'
import { AnchorList, type AnchorListHandle, type AnchorListProps } from './index'
import { LanesList } from './lanes'
import { StickyItem, StickyOverlay } from './sticky'

interface Item {
  id: string
}
const make = (n: number, prefix: string): Item[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))
const getKey = (item: Item): string => item.id
const button = ({ item }: { item: Item }): VNodeChild => h('button', item.id)

type Props = Partial<AnchorListProps<Item>> & { items: Item[] } & Record<string, unknown>
type Slots = Record<string, (arg: never) => VNodeChild>

let layout: TestLayout
let container: HTMLElement
let app: App | null
const props = shallowRef<Props>({ items: [] })
const slots = shallowRef<Slots>({})
const handle = shallowRef<AnchorListHandle | null>(null)
const scroller = (): HTMLElement => document.getElementById('sc')!
const row = (key: string): HTMLElement | null => scroller().querySelector(`[data-key="${key}"]`)
const keys = (): string[] => Array.from(scroller().querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key!)
const flush = async (): Promise<void> => {
  await nextTick()
  await nextTick()
}

/** Mounts `component` once, then updates props and slots; resolves after Vue flushed. */
const render = async (p: Props, s: Slots = {}, component: unknown = AnchorList): Promise<void> => {
  props.value = p
  slots.value = { default: button as Slots[string], ...s }
  if (!app) {
    app = createApp({
      render: () =>
        h(component as never, { ref: (r: unknown) => (handle.value = r as AnchorListHandle), id: 'sc', getKey, estimateSize: () => 50, ...props.value }, slots.value),
    })
    app.mount(container)
  }
  await flush()
}
const scrollTo = async (top: number): Promise<void> => {
  scroller().scrollTop = top
  scroller().dispatchEvent(new Event('scroll'))
  await flush()
}
const focus = async (key: string): Promise<HTMLElement> => {
  const b = row(key)!.querySelector('button')!
  b.focus()
  await flush()
  return b
}

beforeEach(() => {
  layout = installLayout()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  app?.unmount()
  app = null
  container.remove()
  layout.restore()
  vi.restoreAllMocks()
})

describe('focus preservation', () => {
  it('keeps the focused row mounted out of flow at its own position, before the rows', async () => {
    await render({ items: make(500, 'i') })
    const b = await focus('i3')
    const el = row('i3')!
    await scrollTo(200 * 50)
    expect(row('i3')).toBe(el)
    expect(document.activeElement).toBe(b)
    expect(el.style.position).toBe('absolute')
    expect(el.style.top).toBe('150px')
    expect(el.getAttribute('aria-posinset')).toBe('4')
    // Kept rows sit before or after the planned rows, never in between.
    expect(keys()[0]).toBe('i3')
    expect(keys().slice(1).every((k) => Number(k.slice(1)) > 150)).toBe(true)
    // Back in range: in flow again, same node, still focused.
    await scrollTo(0)
    expect(row('i3')).toBe(el)
    expect(el.style.position).toBe('')
    expect(document.activeElement).toBe(b)
  })

  it('keeps a focused row after the range and follows it through a prepend', async () => {
    await render({ items: make(500, 'i') })
    await scrollTo(100 * 50)
    const b = await focus('i110')
    const el = row('i110')!
    await scrollTo(0)
    expect(row('i110')).toBe(el)
    expect(el.style.top).toBe('5500px')
    expect(keys()[keys().length - 1]).toBe('i110')
    // A prepend changes every index: the row is found by key and stays mounted.
    await render({ items: [...make(10, 'p'), ...make(500, 'i')] })
    expect(row('i110')).toBe(el)
    expect(document.activeElement).toBe(b)
    expect(el.getAttribute('data-index')).toBe('120')
  })

  it('lets the row unmount once focus leaves the list', async () => {
    await render({ items: make(500, 'i') })
    const b = await focus('i3')
    b.blur()
    await scrollTo(200 * 50)
    expect(row('i3')).toBeNull()
  })

  it('drops the kept row when its item is removed', async () => {
    await render({ items: make(500, 'i') })
    await focus('i3')
    await scrollTo(200 * 50)
    await render({ items: make(500, 'i').filter((m) => m.id !== 'i3') })
    expect(row('i3')).toBeNull()
  })
})

describe('resize callbacks', () => {
  it('re-renders in a later task, never inside the ResizeObserver delivery', async () => {
    let fire = (): void => undefined
    const RO = globalThis.ResizeObserver
    globalThis.ResizeObserver = class extends RO {
      constructor(cb: ResizeObserverCallback) {
        super(cb)
        fire = () => cb([], this)
      }
    }
    try {
      await render({ items: make(500, 'i') })
      const before = keys().length
      layout.viewport = 1500
      fire()
      // Microtasks (Vue's flush) run before the browser delivers the next observations: no rows yet.
      await flush()
      expect(keys().length).toBe(before)
      await new Promise((r) => setTimeout(r))
      await flush()
      expect(keys().length).toBeGreaterThan(before)
    } finally {
      globalThis.ResizeObserver = RO
    }
  })
})

describe('aria', () => {
  it('sets aria-busy on the list from busy', async () => {
    await render({ items: make(10, 'i'), busy: true })
    const list = scroller().querySelector('[role="list"]')!
    expect(list.getAttribute('aria-busy')).toBe('true')
    await render({ items: make(10, 'i') })
    expect(list.getAttribute('aria-busy')).toBe('false')
  })
})

describe('scroller', () => {
  it('creates the scroller from the elements on mount and leaves overflow to it', async () => {
    const factory = vi.fn((e: ElementScrollerOptions) => elementScroller(e))
    await render({ items: make(100, 'i'), scroller: factory })
    expect(factory).toHaveBeenCalledTimes(1)
    const e = factory.mock.calls[0]![0]
    expect(e.element).toBe(scroller())
    expect(e.list).toBe(scroller().querySelector('[role="list"]'))
    expect(scroller().style.overflowY).toBe('')
    expect(scroller().style.position).toBe('relative')
    await render({ items: make(101, 'i'), scroller: factory })
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('scrolls the container itself by default', async () => {
    await render({ items: make(10, 'i') })
    expect(scroller().style.overflowY).toBe('auto')
  })

  it('exposes the scroll container as element', async () => {
    await render({ items: make(10, 'i') })
    expect(handle.value!.element).toBe(scroller())
  })

  it('horizontal() lays the list out in a row and creates the base scroller on the horizontal axis', async () => {
    const base = vi.fn((e: ElementScrollerOptions) => elementScroller(e))
    await render({ items: make(10, 'i'), scroller: horizontal(base) })
    const list = scroller().querySelector<HTMLElement>('[role="list"]')!
    expect(base.mock.calls[0]![0].axis).toBe(HORIZONTAL)
    expect(scroller().style.overflowX).toBe('auto')
    expect(list.style.flexDirection).toBe('row')
    expect(list.parentElement!.style.display).toBe('flex')
  })
})

describe('server rendering', () => {
  const ssrProps = { id: 'sc', items: make(100, 'i'), getKey, estimateSize: () => 50, initialRect: { width: 400, height: 600 }, initialPlan }
  const ssr = (p: Record<string, unknown>): App => createSSRApp({ render: () => h(AnchorList as never, p, { default: button }) })

  it('renders the rows that fill initialRect on the server, from the align edge', async () => {
    const start = await renderToString(ssr(ssrProps))
    expect(start.match(/data-key="i\d+"/g)).toEqual(make(12, 'i').map((m) => `data-key="${m.id}"`))
    const end = await renderToString(ssr({ ...ssrProps, align: 'end' }))
    expect(end.match(/data-key="(i\d+)"/g)).toEqual(make(100, 'i').slice(88).map((m) => `data-key="${m.id}"`))
  })

  it('renders no rows on the server without initialPlan', async () => {
    const html = await renderToString(ssr({ ...ssrProps, initialPlan: undefined }))
    expect(html).not.toContain('data-key')
  })

  it('hydrates the server markup without a mismatch, then takes over', async () => {
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    container.innerHTML = await renderToString(ssr(ssrProps))
    app = ssr(ssrProps)
    app.mount(container)
    await flush()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(keys()[0]).toBe('i0')
    expect(row('i0')!.getAttribute('data-index')).toBe('0')
  })
})

describe('StickyItem', () => {
  const items = make(200, 'i')
  /** Items 0, 50, 100 and 150 are headers. */
  const isHeader = (m: Item): boolean => Number(m.id.slice(1)) % 50 === 0
  const stuck = (): HTMLElement | null => scroller().querySelector('[aria-hidden="true"]')
  let height: PropertyDescriptor | undefined

  beforeEach(async () => {
    // happy-dom has no layout: the stuck copy is 50 px like every row.
    height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 50 })
    await render(
      { items },
      {
        default: (({ item }: { item: Item }) => h('span', item.id)) as Slots[string],
        sticky: ((list: never) =>
          h(StickyOverlay as never, { list }, {
            default: (range: never) => h(StickyItem as never, { range, items, isSticky: isHeader }, { default: ({ item }: { item: Item }) => h('span', item.id) }),
          })) as Slots[string],
      },
    )
  })

  afterEach(() => {
    if (height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', height)
    else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
  })

  it('copies the header at the viewport start, outside the list and hidden from assistive technology', async () => {
    expect(stuck()?.textContent).toBe('i0')
    expect(stuck()!.closest('[role="list"]')).toBeNull()
    expect(stuck()!.querySelector('[data-index]')).toBeNull()
    expect(stuck()!.hasAttribute('inert')).toBe(true)
    await scrollTo(30 * 50)
    expect(stuck()?.textContent).toBe('i0')
  })

  it('keeps an unmounted header stuck', async () => {
    await scrollTo(80 * 50)
    expect(row('i50')).toBeNull()
    expect(stuck()?.textContent).toBe('i50')
    expect(stuck()!.style.transform).toBe('translateY(0px)')
  })

  it('is pushed out by the next header, then replaced by it', async () => {
    // Row 49 spans -25..25 px, so header 50 starts 25 px down and pushes the 50 px copy up by 25 px.
    await scrollTo(49 * 50 + 25)
    expect(stuck()?.textContent).toBe('i0')
    expect(stuck()!.style.transform).toBe('translateY(-25px)')
    await scrollTo(50 * 50 + 10)
    expect(stuck()?.textContent).toBe('i50')
    expect(stuck()!.style.transform).toBe('translateY(0px)')
  })

  it('removes its scroll listener on unmount', async () => {
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    await render({ items }, { default: (({ item }: { item: Item }) => h('span', item.id)) as Slots[string] })
    expect(stuck()).toBeNull()
    expect(remove.mock.calls.some((c) => c[0] === 'scroll')).toBe(true)
  })
})

describe('LanesList', () => {
  it('positions items absolutely in lanes, with every AnchorList prop passed through', async () => {
    const lanes = grid({ lanes: 3, gap: 0 })
    await render({ items: make(300, 'i'), lanes, 'row-class': 'cell' }, {}, LanesList)
    const list = scroller().querySelector<HTMLElement>('[role="list"]')!
    expect(list.style.position).toBe('relative')
    expect(scroller().style.overflowY).toBe('auto')
    const cells = [row('i0')!, row('i1')!, row('i2')!, row('i3')!]
    expect(cells.every((c) => c.style.position === 'absolute' && c.className === 'cell')).toBe(true)
    // One grid row of three lanes, then the next row below it (happy-dom drops the `calc()` cross offset).
    expect([0, 1, 2].map((i) => lanes.position(i).lane)).toEqual([0, 1, 2])
    expect(cells[3]!.style.top).toBe(`${lanes.position(3).start}px`)
    expect(lanes.position(3)).toMatchObject({ lane: 0 })
    expect(lanes.position(3).start).toBeGreaterThan(lanes.position(0).start)
    // The template ref reaches the inner list's handle; `count` is not leaked to the DOM.
    expect(handle.value!.element).toBe(scroller())
    expect(handle.value!.indexOf('i10')).toBe(10)
    expect(scroller().hasAttribute('count')).toBe(false)
  })

  it('hands prepended items to the lanes before the list commits', async () => {
    const lanes = grid({ lanes: 3, gap: 0 })
    await render({ items: make(300, 'i'), lanes }, {}, LanesList)
    await render({ items: [...make(3, 'p'), ...make(300, 'i')], lanes }, {}, LanesList)
    expect(row('p0')).not.toBeNull()
    expect(handle.value!.indexOf('i0')).toBe(3)
    expect(lanes.position(3)).toMatchObject({ lane: 0 })
    expect(lanes.position(3).start).toBe(lanes.position(0).start + 50)
  })
})
