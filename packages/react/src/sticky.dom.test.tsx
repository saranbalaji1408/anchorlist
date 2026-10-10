import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AnchorList } from './index'
import { StickyItem } from './sticky'
import { installLayout, type TestLayout } from './testLayout'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
}
const items: Item[] = Array.from({ length: 200 }, (_, i) => ({ id: `i${i}` }))
/** Items 0, 50, 100 and 150 are headers. */
const isHeader = (m: Item): boolean => Number(m.id.slice(1)) % 50 === 0
const renderItem = (m: Item): ReactNode => <span className={isHeader(m) ? 'header' : 'row'}>{m.id}</span>

let layout: TestLayout
let container: HTMLElement
let root: Root
let height: PropertyDescriptor | undefined
const scroller = (): HTMLElement => document.getElementById('sc')!
const stuck = (): Element | null => scroller().querySelector('[aria-hidden="true"]')
const scrollTo = async (top: number): Promise<void> => {
  await act(async () => {
    scroller().scrollTop = top
    scroller().dispatchEvent(new Event('scroll'))
  })
}

beforeEach(async () => {
  layout = installLayout()
  // happy-dom has no layout: the stuck copy is 50 px like every row.
  height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 50 })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <AnchorList<Item>
        items={items}
        getKey={(m) => m.id}
        renderItem={renderItem}
        estimateSize={() => 50}
        scrollerProps={{ id: 'sc' }}
        sticky={(range) => <StickyItem range={range} items={items} isSticky={isHeader} renderItem={renderItem} />}
      />,
    ),
  )
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  if (height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', height)
  else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
  layout.restore()
})

describe('StickyItem', () => {
  it('copies the header at the viewport start, outside the list and hidden from assistive technology', async () => {
    expect(stuck()?.textContent).toBe('i0')
    expect(stuck()!.closest('[role="list"]')).toBeNull()
    expect(stuck()!.querySelector('[data-index]')).toBeNull()
    await scrollTo(30 * 50)
    expect(stuck()?.textContent).toBe('i0')
  })

  it('keeps an unmounted header stuck', async () => {
    await scrollTo(80 * 50)
    expect(scroller().querySelector('[data-key="i50"]')).toBeNull()
    expect(stuck()?.textContent).toBe('i50')
    expect((stuck() as HTMLElement).style.transform).toBe('')
  })

  it('is pushed out by the next header, then replaced by it', async () => {
    // Row 49 spans -25..25 px, so header 50 starts 25 px down and pushes the 50 px copy up by 25 px.
    await scrollTo(49 * 50 + 25)
    expect(stuck()?.textContent).toBe('i0')
    expect((stuck() as HTMLElement).style.transform).toBe('translateY(-25px)')
    await scrollTo(50 * 50 + 10)
    expect(stuck()?.textContent).toBe('i50')
    expect((stuck() as HTMLElement).style.transform).toBe('')
  })
})
