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
    rect,
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
  /** Each ResizeObserver's callback and the elements it currently observes. */
  const observers: Array<{ cb: () => void; els: Set<unknown> }> = []
  vi.stubGlobal('document', { documentElement: root })
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: Listener) => void win.set(type, fn),
    removeEventListener: (type: string) => void win.delete(type),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      o: { cb: () => void; els: Set<unknown> }
      constructor(cb: () => void) {
        observers.push((this.o = { cb, els: new Set() }))
      }
      observe(el: unknown) {
        this.o.els.add(el)
      }
      unobserve(el: unknown) {
        this.o.els.delete(el)
      }
      disconnect() {
        this.o.els.clear()
      }
    },
  )
  return { root, win, observers }
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
    // Input outside the list scrolls the page too: animateToKey also listens there.
    expect(sc.inputTarget).toBe(window)
    sc.setSpacers(10, 20)
    expect(list.style).toEqual({ paddingTop: '10px', paddingBottom: '20px' })
    sc.translate(-5)
    expect(content.style).toEqual({ transform: 'translateY(-5px)' })
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
    const { root, win, observers } = stubWindow()
    const list = fakeElement({})
    const content = fakeElement({})
    const sc = windowScroller({ element: {} as never, list: list as never, content: content as never } as never)
    const events: ScrollerEvent[] = []
    const off = sc.listen((e) => events.push(e))
    // The document element is not observed with the rows: it resizes on any page change.
    expect(observers.map((o) => [...o.els])).toEqual([[content, list], [root]])
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
    expect(observers.every((o) => o.els.size === 0)).toBe(true)
  })

  it('reports a document resize only when it moves the list or resizes the page outside the content', () => {
    const { root, observers } = stubWindow()
    const list = fakeElement({ top: 300, height: 2000 })
    const content = fakeElement({ top: 280, height: 2100 })
    const sc = windowScroller({ list: list as never, content: content as never })
    const events: ScrollerEvent[] = []
    sc.listen((e) => events.push(e))
    const page = observers[1]!
    // An unrelated change elsewhere on the page (a sidebar), and the observer's first call.
    page.cb()
    expect(events).toEqual([])
    // The content grows with its rows: the content observer reports that, not this one.
    content.rect.height = 2400
    root.scrollHeight += 300
    page.cb()
    expect(events).toEqual([])
    // Page content above the list grows: the list moves.
    list.rect.top = 700
    content.rect.top = 680
    root.scrollHeight += 400
    page.cb()
    expect(events).toEqual(['resize'])
    // A page footer grows: the scroll range changes outside the content.
    root.scrollHeight += 50
    page.cb()
    expect(events).toEqual(['resize', 'resize'])
    // A page scroll alone moves the list in the viewport, not in the page.
    root.scrollTop = 100
    list.rect.top = 600
    page.cb()
    expect(events).toEqual(['resize', 'resize'])
  })

  it('turns off browser scroll anchoring on the content while attached and restores it on detach', () => {
    stubWindow()
    const list = fakeElement({})
    const content = fakeElement({})
    ;(content.style as Record<string, string>).overflowAnchor = 'auto'
    const sc = windowScroller({ list: list as never, content: content as never })
    expect(content.style.overflowAnchor).toBe('auto')
    const off = sc.listen(() => {})
    expect(content.style.overflowAnchor).toBe('none')
    off()
    expect(content.style.overflowAnchor).toBe('auto')
  })
})
