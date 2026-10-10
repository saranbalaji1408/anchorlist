import { act, createRef, StrictMode, version, type ReactNode, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnchorList, type AnchorListHandle, type AnchorListProps } from './index'
import { installLayout, type TestLayout } from './testLayout'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
}
const make = (n: number, prefix: string): Item[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))

let renders: Record<string, number> = {}
let withoutScroller: string[] = []
function Cell({ item }: { item: Item }): ReactNode {
  renders[item.id] = (renders[item.id] ?? 0) + 1
  if (!document.getElementById('sc')) withoutScroller.push(item.id)
  return item.id
}
const renderItem = (item: Item): ReactNode => <Cell item={item} />
const getKey = (item: Item): string => item.id

type Props = Partial<AnchorListProps<Item>> & { items: Item[] }
const List = (props: Props & { listRef?: Ref<AnchorListHandle> }): ReactNode => (
  <AnchorList<Item> ref={props.listRef} getKey={getKey} renderItem={renderItem} scrollerProps={{ id: 'sc' }} {...props} />
)

let layout: TestLayout
let container: HTMLElement
let root: Root
const scroller = (): HTMLElement => document.getElementById('sc')!
const keys = (): string[] => Array.from(scroller().querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key!)
const render = async (ui: ReactNode): Promise<void> => {
  await act(async () => root.render(ui))
}

beforeEach(() => {
  layout = installLayout()
  renders = {}
  withoutScroller = []
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  layout.restore()
  vi.restoreAllMocks()
})

it('runs on the React major under test', () => {
  // `pnpm test:react18` runs this file against React 18; `pnpm test` against React 19.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  expect(version.split('.')[0]).toBe(env?.EXPECT_REACT_MAJOR ?? '19')
})

describe('mount', () => {
  it('mounts rows after the scroll container, at the end for align end', async () => {
    await render(<List items={make(100, 'i')} align="end" />)
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
    await render(<List items={make(100, 'i')} header={<header>h</header>} footer={<footer>f</footer>} />)
    expect(scroller().scrollTop).toBe(0)
    expect(keys()[0]).toBe('i0')
    const content = scroller().querySelector('[role="list"]')!.parentElement!
    expect(Array.from(content.children).map((e) => e.tagName)).toEqual(['HEADER', 'DIV', 'FOOTER'])
  })

  it('keeps the spacers written by the engine across re-renders', async () => {
    await render(<List items={make(100, 'i')} align="end" />)
    const list = scroller().querySelector<HTMLElement>('[role="list"]')!
    const before = list.style.paddingTop
    expect(parseFloat(before)).toBeGreaterThan(0)
    await render(<List items={make(100, 'i')} align="end" className="x" />)
    expect(list.style.paddingTop).toBe(before)
  })
})

describe('StrictMode and cleanup', () => {
  it('re-attaches after the StrictMode effect cycle and leaves one live listener set', async () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    await render(
      <StrictMode>
        <List items={make(100, 'i')} align="end" />
      </StrictMode>,
    )
    const scrolls = (spy: typeof add): number => spy.mock.calls.filter((c) => c[0] === 'scroll').length
    expect(scrolls(add) - scrolls(remove)).toBe(1)
    expect(layout.observers()).toBe(1)
    expect(keys()).toContain('i99')
    expect(withoutScroller).toEqual([])
    // The surviving instance still works: a user scroll re-renders the range.
    const sc = scroller()
    await act(async () => {
      sc.scrollTop = 0
      sc.dispatchEvent(new Event('scroll'))
    })
    expect(keys()[0]).toBe('i0')
    act(() => root.unmount())
    expect(scrolls(add) - scrolls(remove)).toBe(0)
    expect(layout.observers()).toBe(0)
    root = createRoot(container)
  })

  it('destroys on unmount: removes listeners, disconnects the observer and clears a deferred transform', async () => {
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    await render(<List items={make(100, 'i')} align="end" />)
    expect(layout.observers()).toBe(1)
    const content = scroller().querySelector<HTMLElement>('[role="list"]')!.parentElement!
    content.style.transform = 'translateY(5px)' // as if a correction were deferred
    act(() => root.unmount())
    expect(layout.observers()).toBe(0)
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['scroll', 'wheel', 'touchstart']))
    root = createRoot(container)
  })
})

describe('key-only rows', () => {
  it('re-renders no mounted row on a prepend, trim or append when renderItem is stable', async () => {
    const items = make(100, 'i')
    await render(<List items={items} align="end" />)
    const mounted = keys()
    renders = {}
    await render(<List items={[...make(20, 'p'), ...items.slice(3), ...make(2, 'a')]} align="end" />)
    const kept = keys().filter((k) => mounted.includes(k))
    expect(kept.length).toBeGreaterThan(5)
    for (const k of kept) expect(renders[k] ?? 0, k).toBe(0)
    // The engine re-indexed the mounted rows itself.
    expect(scroller().querySelector('[data-key="i99"]')!.getAttribute('data-index')).toBe('116')
  })

  it('re-renders mounted rows when renderItem changes identity', async () => {
    const items = make(100, 'i')
    await render(<List items={items} renderItem={(m) => <Cell item={m} />} />)
    renders = {}
    await render(<List items={items} renderItem={(m) => <Cell item={m} />} />)
    expect(Object.keys(renders).length).toBe(keys().length)
  })
})

describe('imperative handle', () => {
  it('scrolls to keys and edges and reports the state', async () => {
    const ref = createRef<AnchorListHandle>()
    await render(<List items={make(500, 'i')} align="end" listRef={ref} />)
    const h = ref.current!
    expect(h.isAtEdge()).toBe(true)
    expect(h.indexOf('i10')).toBe(10)
    expect(h.scrollToKey('nope')).toBe(false)
    await act(async () => {
      expect(h.scrollToKey('i10')).toBe(true)
    })
    expect(keys()).toContain('i10')
    const top = (k: string): number => scroller().querySelector(`[data-key="${k}"]`)!.getBoundingClientRect().top
    expect(top('i10')).toBe(0)
    expect(h.isAtEdge()).toBe(false)
    expect(h.getItemRect('i10')).toMatchObject({ start: scroller().scrollTop, size: 50, measured: true })
    await act(async () => h.scrollToEdge())
    expect(h.isAtEdge()).toBe(true)
    expect(h.getSnapshot().pinned).toBe(true)
    // Unmeasured rows count with the 48 px default estimate.
    expect(h.getTotalSize()).toBeGreaterThanOrEqual(500 * 48)
    expect(h.getTotalSize()).toBeLessThanOrEqual(500 * 50)
    await act(async () => {
      expect(h.scrollToIndex(250, { align: 'center' })).toBe(true)
    })
    expect(top('i250') + 25).toBe(300)
  })

  it('renders the sticky overlay from the visible range', async () => {
    const ref = createRef<AnchorListHandle>()
    const sticky = (r: { startKey: string | number | null }): ReactNode => <span data-testid="pill">{r.startKey}</span>
    await render(<List items={make(100, 'i')} sticky={sticky} listRef={ref} />)
    const pill = (): string | null | undefined => document.querySelector('[data-testid="pill"]')?.textContent
    expect(pill()).toBe('i0')
    await act(async () => {
      ref.current!.scrollToKey('i40')
    })
    expect(pill()).toBe('i40')
    expect(ref.current!.getVisibleRange()).toMatchObject({ startKey: 'i40', endKey: 'i51' })
  })
})
