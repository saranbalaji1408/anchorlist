import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AnchorList, type AnchorListProps } from './index'
import { installLayout, type TestLayout } from './testLayout'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
}
const make = (n: number, prefix: string): Item[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))
const renderItem = (item: Item): ReactNode => <button>{item.id}</button>

let layout: TestLayout
let container: HTMLElement
let root: Root
const scroller = (): HTMLElement => document.getElementById('sc')!
const row = (key: string): HTMLElement | null => scroller().querySelector(`[data-key="${key}"]`)
const render = async (props: Partial<AnchorListProps<Item>> & { items: Item[] }): Promise<void> => {
  await act(async () =>
    root.render(
      <AnchorList<Item> getKey={(m) => m.id} renderItem={renderItem} estimateSize={() => 50} scrollerProps={{ id: 'sc' }} {...props} />,
    ),
  )
}
const scrollTo = async (top: number): Promise<void> => {
  await act(async () => {
    scroller().scrollTop = top
    scroller().dispatchEvent(new Event('scroll'))
  })
}
const focus = async (key: string): Promise<HTMLElement> => {
  const button = row(key)!.querySelector('button')!
  await act(async () => button.focus())
  return button
}

beforeEach(() => {
  layout = installLayout()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  layout.restore()
})

describe('focus preservation', () => {
  it('keeps the focused row mounted out of flow at its own position, after the rows', async () => {
    await render({ items: make(500, 'i') })
    const button = await focus('i3')
    const el = row('i3')!
    await scrollTo(200 * 50)
    expect(row('i3')).toBe(el)
    expect(document.activeElement).toBe(button)
    expect(el.style.position).toBe('absolute')
    expect(el.style.top).toBe('150px')
    // Still indexed by the engine.
    expect(el.getAttribute('aria-posinset')).toBe('4')
    // Kept rows sit before or after the planned rows, never in between.
    const keys = Array.from(scroller().querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key)
    expect(keys[0]).toBe('i3')
    expect(keys.slice(1).every((k) => Number(k!.slice(1)) > 150)).toBe(true)
    // Back in range: in flow again, same node, still focused.
    await scrollTo(0)
    expect(row('i3')).toBe(el)
    expect(el.style.position).toBe('')
    expect(document.activeElement).toBe(button)
  })

  it('keeps a focused row after the range and follows it through a prepend', async () => {
    await render({ items: make(500, 'i') })
    await scrollTo(100 * 50)
    const button = await focus('i110')
    const el = row('i110')!
    await scrollTo(0)
    expect(row('i110')).toBe(el)
    expect(el.style.top).toBe('5500px')
    const keys = Array.from(scroller().querySelectorAll<HTMLElement>('[data-key]')).map((e) => e.dataset.key)
    expect(keys[keys.length - 1]).toBe('i110')
    // A prepend changes every index: the row is found by key and stays mounted.
    await render({ items: [...make(10, 'p'), ...make(500, 'i')] })
    expect(row('i110')).toBe(el)
    expect(document.activeElement).toBe(button)
    expect(el.getAttribute('data-index')).toBe('120')
  })

  it('lets the row unmount once focus leaves the list', async () => {
    await render({ items: make(500, 'i') })
    const button = await focus('i3')
    await act(async () => button.blur())
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

describe('aria', () => {
  it('sets aria-busy on the list from busy', async () => {
    await render({ items: make(10, 'i'), busy: true })
    const list = scroller().querySelector('[role="list"]')!
    expect(list.getAttribute('aria-busy')).toBe('true')
    await render({ items: make(10, 'i') })
    expect(list.hasAttribute('aria-busy')).toBe(false)
  })
})
