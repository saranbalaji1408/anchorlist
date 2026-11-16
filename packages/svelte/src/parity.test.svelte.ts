import { elementScroller, HORIZONTAL, type ElementScrollerOptions, type Plan, type Virtualizer, type VirtualizerOptions } from '@anchorlist/core'
import { grid } from '@anchorlist/core/lanes'
import { createRawSnippet, flushSync, mount, tick, unmount, type Snippet } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installLayout, type TestLayout } from '../../react/src/testLayout'
import { horizontal } from './horizontal'
import { AnchorList, type AnchorListHandle, type AnchorListProps } from './index'
import Lanes from './Lanes.test.svelte'
import Sticky from './Sticky.test.svelte'

interface Item {
  id: string
}
const make = (n: number, prefix: string): Item[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))
const getKey = (item: Item): string => item.id
const button: Snippet<[Item]> = createRawSnippet((item: () => Item) => ({
  render: () => '<button></button>',
  setup(node) {
    $effect(() => void (node.textContent = item().id))
  },
}))

type Props = Partial<AnchorListProps<Item>> & { items: Item[] } & Record<string, unknown>

let layout: TestLayout
let container: HTMLElement
let instance: (AnchorListHandle & Record<string, unknown>) | null = null
let current: Props = $state.raw({ items: [] })
const props = new Proxy({} as Props, {
  get: (_, k) => current[k as string],
  has: (_, k) => k in current,
  ownKeys: () => Reflect.ownKeys(current),
  getOwnPropertyDescriptor: (_, k) => (k in current ? { enumerable: true, configurable: true, value: current[k as string] } : undefined),
})
const scroller = (): HTMLElement => document.getElementById('sc')!
const row = (key: string): HTMLElement | null => scroller().querySelector(`[data-key="${key}"]`)
const keys = (): string[] => Array.from(scroller().querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key!)

const render = async (p: Props): Promise<void> => {
  current = { id: 'sc', getKey, children: button, estimateSize: () => 50, ...p }
  if (!instance) instance = mount(AnchorList<Item>, { target: container, props: props as AnchorListProps<Item> }) as never
  flushSync()
  await tick()
}
const destroy = (): void => {
  if (instance) unmount(instance)
  instance = null
}
const scrollTo = async (top: number): Promise<void> => {
  scroller().scrollTop = top
  scroller().dispatchEvent(new Event('scroll'))
  await tick()
}
const focus = (key: string): HTMLElement => {
  const b = row(key)!.querySelector('button')!
  b.focus()
  return b
}

beforeEach(() => {
  layout = installLayout()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  destroy()
  container.remove()
  layout.restore()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('focus preservation', () => {
  it('keeps the focused row mounted out of flow at its own position, before the rows', async () => {
    await render({ items: make(500, 'i') })
    const b = focus('i3')
    const el = row('i3')!
    await scrollTo(200 * 50)
    expect(row('i3')).toBe(el)
    expect(document.activeElement).toBe(b)
    expect(el.style.position).toBe('absolute')
    expect(el.style.top).toBe('150px')
    // Still indexed by the engine.
    expect(el.getAttribute('aria-posinset')).toBe('4')
    // Kept rows sit before or after the planned rows, never in between.
    expect(keys()[0]).toBe('i3')
    expect(keys().slice(1).every((k) => Number(k.slice(1)) > 150)).toBe(true)
    // Back in range: in flow again, same node, still focused.
    await scrollTo(0)
    expect(row('i3')).toBe(el)
    expect(el.style.position).toBe('')
    expect(el.style.display).toBe('flow-root')
    expect(document.activeElement).toBe(b)
  })

  it('keeps a focused row after the range and follows it through a prepend', async () => {
    await render({ items: make(500, 'i') })
    await scrollTo(100 * 50)
    const b = focus('i110')
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
    focus('i3').blur()
    await scrollTo(200 * 50)
    expect(row('i3')).toBeNull()
  })

  it('drops the kept row when its item is removed', async () => {
    await render({ items: make(500, 'i') })
    focus('i3')
    await scrollTo(200 * 50)
    await render({ items: make(500, 'i').filter((m) => m.id !== 'i3') })
    expect(row('i3')).toBeNull()
  })
})

describe('aria', () => {
  it('sets aria-busy on the list from busy', async () => {
    await render({ items: make(10, 'i'), busy: true })
    const list = scroller().querySelector('[role="list"]')!
    expect(list.getAttribute('aria-busy')).toBe('true')
    await render({ items: make(10, 'i') })
    expect(list.hasAttribute('aria-busy')).toBe(false)
    expect(scroller().hasAttribute('busy')).toBe(false)
  })
})

describe('scroller', () => {
  it('scrolls the container vertically by default, also after the style changes', async () => {
    await render({ items: make(10, 'i'), style: 'height: 600px' })
    expect(scroller().style.overflowY).toBe('auto')
    await render({ items: make(10, 'i'), style: 'height: 500px' })
    expect(scroller().style.overflowY).toBe('auto')
    expect(scroller().style.position).toBe('relative')
  })

  it('creates a custom scroller from the elements on mount and keeps its overflow when the style changes', async () => {
    const factory = vi.fn((e: ElementScrollerOptions) => horizontal()(e))
    await render({ items: make(10, 'i'), scroller: factory, style: 'height: 100px' })
    expect(factory).toHaveBeenCalledTimes(1)
    const e = factory.mock.calls[0]![0]
    expect(e.element).toBe(scroller())
    expect(e.list).toBe(scroller().querySelector('[role="list"]'))
    expect(e.content).toBe(e.list.parentElement)
    expect(scroller().style.overflowX).toBe('auto')
    expect(scroller().style.overflowY).toBe('')
    await render({ items: make(20, 'i'), scroller: factory, style: 'height: 120px' })
    expect(factory).toHaveBeenCalledTimes(1)
    expect(scroller().style.height).toBe('120px')
    expect(scroller().style.overflowX).toBe('auto')
  })

  it('keeps a focused row of a horizontal list at its inline start', async () => {
    // The rows in a row, as `horizontal()` lays them out, on the vertical test layout.
    const rowLayout = (e: ElementScrollerOptions): ReturnType<typeof elementScroller> => {
      e.list.style.flexDirection = 'row'
      return elementScroller(e)
    }
    await render({ items: make(500, 'i'), scroller: rowLayout })
    focus('i3')
    const el = row('i3')!
    await scrollTo(200 * 50)
    expect(row('i3')).toBe(el)
    expect(el.style.position).toBe('absolute')
    expect(el.style.height).toBe('100%')
    expect(el.style.top).toBe('')
    expect(el.style.getPropertyValue('inset-inline-start')).toBe('150px')
  })
})

describe('horizontal', () => {
  it('lays the elements out in a row and creates the base scroller on the horizontal axis', () => {
    const element = document.createElement('div')
    const content = document.createElement('div')
    const list = document.createElement('div')
    const base = vi.fn(() => ({}) as never)
    horizontal(base)({ element, list, content })
    expect(element.style.overflowX).toBe('auto')
    expect(list.style.flexDirection).toBe('row')
    expect(content.style.display).toBe('flex')
    expect(content.style.width).toBe('max-content')
    expect(base).toHaveBeenCalledWith({ element, list, content, axis: HORIZONTAL })
  })
})

describe('server rendering', () => {
  it('renders the rows of initialPlan', async () => {
    const initialPlan = vi.fn((v: Virtualizer, o: VirtualizerOptions): Plan => {
      const p = v.plan(o)
      return p.end >= p.start ? p : { start: 0, end: 4, options: o }
    })
    await render({ items: make(100, 'i'), initialRect: { width: 400, height: 250 }, initialPlan })
    expect(initialPlan).toHaveBeenCalled()
    expect(initialPlan.mock.calls[0]![1]).toMatchObject({ count: 100, initialRect: { width: 400, height: 250 } })
    expect(keys()).toContain('i0')
    expect(scroller().hasAttribute('initialRect')).toBe(false)
    expect(scroller().hasAttribute('initialPlan')).toBe(false)
  })
})

describe('handle', () => {
  it('returns the scroll container from getElement', async () => {
    await render({ items: make(10, 'i') })
    expect(instance!.getElement()).toBe(scroller())
  })
})

describe('re-render requests', () => {
  it('renders a resize-driven range change in a task, not in a microtask', async () => {
    let size = 50
    const observers: ResizeObserverCallback[] = []
    const RO = globalThis.ResizeObserver
    globalThis.ResizeObserver = class extends RO {
      constructor(cb: ResizeObserverCallback) {
        super(cb)
        observers.push(cb)
      }
    } as typeof ResizeObserver
    await render({ items: make(100, 'i') })
    const before = keys().length
    // Every row shrinks: more rows fit, which needs a re-render.
    size = 10
    for (const k of keys()) layout.sizes.set(k, size)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => size)
    const rows = Array.from(scroller().querySelectorAll('[data-key]'))
    observers.forEach((cb) =>
      cb(rows.map((target) => ({ target, borderBoxSize: [{ blockSize: size, inlineSize: 400 }] }) as unknown as ResizeObserverEntry), {} as ResizeObserver),
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(keys().length).toBe(before)
    await new Promise((r) => setTimeout(r))
    flushSync()
    expect(keys().length).toBeGreaterThan(before)
  })
})

describe('StickyItem', () => {
  /** Items 0, 50, 100 and 150 are headers. */
  const isHeader = (m: Item): boolean => Number(m.id.slice(1)) % 50 === 0
  const stuck = (): HTMLElement | null => scroller().querySelector('[aria-hidden="true"]')

  it('copies the header at the viewport start, outside the list, inert and hidden from assistive technology', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50)
    const app = mount(Sticky, { target: container, props: { items: make(200, 'i'), isSticky: isHeader } })
    flushSync()
    await tick()
    expect(stuck()?.textContent).toBe('i0')
    expect(stuck()!.closest('[role="list"]')).toBeNull()
    expect(stuck()!.hasAttribute('inert')).toBe(true)
    await scrollTo(80 * 50)
    await tick()
    expect(row('i50')).toBeNull()
    expect(stuck()?.textContent).toBe('i50')
    expect(stuck()!.style.transform).toBe('translateY(0px)')
    // Row 99 spans -25..25 px, so header 100 starts 25 px down and pushes the 50 px copy up by 25 px.
    await scrollTo(99 * 50 + 25)
    await tick()
    expect(stuck()?.textContent).toBe('i50')
    expect(stuck()!.style.transform).toBe('translateY(-25px)')
    unmount(app)
  })
})

describe('LanesList', () => {
  it('positions the items in lanes, syncing the lanes before each commit', async () => {
    const lanes = grid({ lanes: 2 })
    const sync = vi.spyOn(lanes, 'sync')
    const app = mount(Lanes, { target: container, props: { items: make(100, 'i'), lanes } })
    flushSync()
    await tick()
    expect(sync).toHaveBeenCalled()
    expect(sync.mock.calls[0]![0]).toMatchObject({ count: 100 })
    const list = scroller().querySelector<HTMLElement>('[role="list"]')!
    expect(list.style.position).toBe('relative')
    // The lanes own the gap.
    expect(list.style.gap).toBe('')
    expect(scroller().style.overflowY).toBe('auto')
    const a = row('i0')!
    const b = row('i1')!
    expect(a.style.position).toBe('absolute')
    expect(a.style.top).toBe(b.style.top)
    expect(a.style.getPropertyValue('inset-inline-start')).not.toBe(b.style.getPropertyValue('inset-inline-start'))
    unmount(app)
  })
})
