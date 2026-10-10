import { afterEach, describe, expect, it, vi } from 'vitest'
import { HORIZONTAL, type ScrollerEvent } from './scroller'
import { windowScroller } from './window'

type Listener = (e: { type: string }) => void

/** Just enough of an element: a rect, a style, attributes and listeners. */
const fakeElement = (rect: { top?: number; left?: number; height?: number; width?: number }) => {
  const listeners = new Map<string, Listener>()
  return {
    style: {} as Record<string, string>,
    listeners,
    getBoundingClientRect: () => ({ top: rect.top ?? 0, left: rect.left ?? 0, height: rect.height ?? 0, width: rect.width ?? 0 }),
    setAttribute: () => undefined,
    addEventListener: (type: string, fn: Listener) => void listeners.set(type, fn),
    removeEventListener: (type: string) => void listeners.delete(type),
  }
}

/** A document element that scrolls the window, and the window's own listeners. */
const stubWindow = () => {
  const root = {
    ...fakeElement({}),
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight: 800,
    clientWidth: 1200,
    scrollHeight: 5000,
    scrollWidth: 1200,
  }
  const win = new Map<string, Listener>()
  const observed: unknown[] = []
  vi.stubGlobal('document', { documentElement: root })
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: Listener) => void win.set(type, fn),
    removeEventListener: (type: string) => void win.delete(type),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(el: unknown) {
        observed.push(el)
      }
      unobserve() {}
      disconnect() {}
    },
  )
  return { root, win, observed }
}

describe('windowScroller', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('scrolls the document and measures relative to the window', () => {
    const { root } = stubWindow()
    const list = fakeElement({ top: 300 })
    const content = fakeElement({ top: 250 })
    const row = fakeElement({ top: 340, height: 42 })
    const sc = windowScroller({ list: list as never, content: content as never })
    sc.setOffset(120)
    expect(root.scrollTop).toBe(120)
    expect(sc.offset()).toBe(120)
    expect(sc.viewport()).toBe(800)
    expect(sc.crossSize()).toBe(1200)
    expect(sc.scrollSize()).toBe(5000)
    expect(sc.measure(row as never)).toEqual({ start: 340, size: 42 })
    expect(sc.listStart()).toBe(300)
    sc.setSpacers(10, 20)
    expect(list.style).toEqual({ paddingTop: '10px', paddingBottom: '20px' })
    expect(content.style.overflowAnchor).toBe('none')
    sc.translate(-5)
    expect(content.style).toEqual({ overflowAnchor: 'none', transform: 'translateY(-5px)' })
    expect(sc.overscrolled()).toBe(0)
    root.scrollTop = -12
    expect(sc.overscrolled()).toBe(-12)
    root.scrollTop = 4230
    expect(sc.overscrolled()).toBe(30)
  })

  it('starts the viewport below the scroll margin', () => {
    const { root } = stubWindow()
    const list = fakeElement({ top: 300 })
    const row = fakeElement({ top: 340, height: 42 })
    const sc = windowScroller({ list: list as never, scrollMargin: 64 })
    expect(sc.viewport()).toBe(736)
    expect(sc.scrollSize()).toBe(4936)
    expect(sc.measure(row as never)).toEqual({ start: 276, size: 42 })
    expect(sc.listStart()).toBe(236)
    // The scroll range is unchanged: offset + viewport reaches the same end.
    root.scrollTop = 4200
    expect(sc.overscrolled()).toBe(0)
    root.scrollTop = 4210
    expect(sc.overscrolled()).toBe(10)
  })

  it('works horizontally', () => {
    const { root } = stubWindow()
    const list = fakeElement({ left: 30 })
    const row = fakeElement({ left: 90, width: 120 })
    const sc = windowScroller({ list: list as never, axis: HORIZONTAL, scrollMargin: 10 })
    sc.setOffset(50)
    expect(root.scrollLeft).toBe(50)
    expect(sc.viewport()).toBe(1190)
    expect(sc.crossSize()).toBe(800)
    expect(sc.measure(row as never)).toEqual({ start: 80, size: 120 })
    expect(sc.listStart()).toBe(20)
  })

  it('listens to the window for scroll and resize, and to the document for input', () => {
    const { root, win, observed } = stubWindow()
    const list = fakeElement({})
    const content = fakeElement({})
    const sc = windowScroller({ element: {} as never, list: list as never, content: content as never } as never)
    const events: ScrollerEvent[] = []
    const off = sc.listen((e) => events.push(e))
    expect(observed).toEqual([root, content, list])
    expect([...win.keys()]).toEqual(['scroll', 'resize'])
    expect([...root.listeners.keys()]).toEqual(['scroll', 'touchstart', 'touchend', 'touchcancel', 'wheel'])
    win.get('scroll')!({ type: 'scroll' })
    win.get('resize')!({ type: 'resize' })
    root.listeners.get('touchstart')!({ type: 'touchstart' })
    root.listeners.get('wheel')!({ type: 'wheel' })
    expect(events).toEqual(['scroll', 'resize', 'touchstart', 'wheel'])
    off()
    expect(win.size).toBe(0)
    expect(root.listeners.size).toBe(0)
  })
})
