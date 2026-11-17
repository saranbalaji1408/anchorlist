import { afterEach, describe, expect, it, vi } from 'vitest'
import { elementScroller, HORIZONTAL, isTouchWebKit, VERTICAL, type ScrollerEvent } from './scroller'
import { simulatedScroller } from './simulatedScroller'

/** Just enough of an HTMLElement for elementScroller. */
const fakeElement = (rect: { top: number; left?: number; height?: number }) => {
  const listeners = new Map<string, (e: { type: string }) => void>()
  const attrs: Record<string, string> = {}
  return {
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight: 500,
    clientWidth: 300,
    scrollHeight: 2000,
    scrollWidth: 300,
    style: {} as Record<string, string>,
    attrs,
    listeners,
    getBoundingClientRect: () => ({ top: rect.top, left: rect.left ?? 0, height: rect.height ?? 0, width: 0 }),
    setAttribute: (name: string, value: unknown) => void (attrs[name] = String(value)),
    addEventListener: (type: string, fn: (e: { type: string }) => void) => void listeners.set(type, fn),
    removeEventListener: (type: string) => void listeners.delete(type),
  }
}

describe('isTouchWebKit', () => {
  it('detects iPhone, iPad and iPadOS desktop mode', () => {
    expect(isTouchWebKit({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15' })).toBe(true)
    expect(isTouchWebKit({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit/605.1.15' })).toBe(true)
    expect(isTouchWebKit({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', maxTouchPoints: 5 })).toBe(true)
    expect(isTouchWebKit({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', maxTouchPoints: 0 })).toBe(false)
    expect(isTouchWebKit({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120' })).toBe(false)
    expect(isTouchWebKit({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile', maxTouchPoints: 5 })).toBe(false)
    expect(isTouchWebKit(undefined)).toBe(false)
  })
})

describe('axis', () => {
  it('maps both axes', () => {
    expect(VERTICAL).toEqual({
      offset: 'scrollTop',
      client: 'clientHeight',
      cross: 'clientWidth',
      scrollSize: 'scrollHeight',
      start: 'top',
      size: 'height',
      padStart: 'paddingTop',
      padEnd: 'paddingBottom',
      translate: 'translateY',
    })
    expect(HORIZONTAL).toEqual({
      offset: 'scrollLeft',
      client: 'clientWidth',
      cross: 'clientHeight',
      scrollSize: 'scrollWidth',
      start: 'left',
      size: 'width',
      padStart: 'paddingLeft',
      padEnd: 'paddingRight',
      translate: 'translateX',
    })
  })
})

describe('elementScroller', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads and writes the DOM along the axis', () => {
    const observed: unknown[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(public cb: () => void) {}
        observe(el: unknown) {
          observed.push(el)
        }
        unobserve() {}
        disconnect() {}
      },
    )
    const el = fakeElement({ top: 100 })
    const list = fakeElement({ top: 140 })
    const content = fakeElement({ top: 120 })
    const row = fakeElement({ top: 180, height: 42 })
    const sc = elementScroller({ element: el as never, list: list as never, content: content as never })
    sc.setOffset(300)
    expect(sc.offset()).toBe(300)
    expect(sc.viewport()).toBe(500)
    expect(sc.crossSize()).toBe(300)
    expect(sc.scrollSize()).toBe(2000)
    expect(sc.measure(row as never)).toEqual({ start: 80, size: 42 })
    expect(sc.listStart()).toBe(40)
    sc.setSpacers(120, 60)
    expect(list.style).toEqual({ paddingTop: '120px', paddingBottom: '60px' })
    sc.translate(-25)
    expect(content.style.transform).toBe('translateY(-25px)')
    sc.translate(0)
    expect(content.style.transform).toBe('')
    sc.setIndex(row as never, 4, 10)
    expect(row.attrs).toEqual({ 'data-index': '4', 'aria-posinset': '5', 'aria-setsize': '10' })
    expect(sc.overscrolled()).toBe(0)
    el.scrollTop = -30
    expect(sc.overscrolled()).toBe(-30)
    el.scrollTop = 1540
    expect(sc.overscrolled()).toBe(40)

    const events: ScrollerEvent[] = []
    const off = sc.listen((e) => events.push(e))
    expect(observed).toEqual([el, content, list])
    expect([...el.listeners.keys()]).toEqual(['scroll', 'touchstart', 'touchend', 'touchcancel', 'wheel'])
    for (const type of ['scroll', 'touchstart', 'touchcancel', 'wheel']) el.listeners.get(type)!({ type })
    expect(events).toEqual(['scroll', 'touchstart', 'touchcancel', 'wheel'])
    off()
    expect(el.listeners.size).toBe(0)
    expect(typeof sc.now()).toBe('number')
  })

  it('works horizontally', () => {
    vi.stubGlobal('ResizeObserver', class {})
    const el = fakeElement({ top: 0, left: 10 })
    const list = fakeElement({ top: 0, left: 30 })
    const sc = elementScroller({ element: el as never, list: list as never, axis: HORIZONTAL })
    sc.setOffset(50)
    expect(el.scrollLeft).toBe(50)
    expect(sc.viewport()).toBe(300)
    expect(sc.listStart()).toBe(20)
    sc.translate(5)
    expect(list.style.transform).toBe('translateX(5px)')
  })
})

describe('simulatedScroller', () => {
  it('lays out header, spacers, gapped rows and footer, and clamps the offset', () => {
    const sim = simulatedScroller({ viewport: 100, header: 10, footer: 5, gap: 2 })
    const a = { size: 20 }
    const b = { size: 30 }
    sim.setRows([a, b])
    sim.setSpacers(40, 50)
    expect(sim.scrollSize()).toBe(10 + 40 + 20 + 2 + 30 + 50 + 5)
    expect(sim.positionOf(b)).toBe(10 + 40 + 22)
    sim.setOffset(1000)
    expect(sim.offset()).toBe(157 - 100)
    expect(sim.measure(b)).toEqual({ start: 72 - 57, size: 30 })
    sim.translate(-7)
    expect(sim.listStart()).toBe(10 - 57 - 7)
  })

  it('queues events like a browser and runs timers in order', () => {
    const sim = simulatedScroller()
    const events: ScrollerEvent[] = []
    sim.listen((e) => events.push(e))
    const a = { size: 2000 }
    sim.setRows([a])
    sim.observe(a)
    sim.userScroll(100)
    sim.resizeElement(a, 1000)
    expect(events).toEqual(['input'])
    const order: number[] = []
    sim.timeout(() => order.push(2), 20)
    sim.timeout(() => order.push(1), 10)
    const cancel = sim.timeout(() => order.push(3), 5)
    cancel()
    sim.frame(() => order.push(0))
    sim.tick()
    expect(events).toEqual(['input', 'scroll', 'resize'])
    expect(order).toEqual([0, 1])
    sim.advance(10)
    expect(order).toEqual([0, 1, 2])
    expect(sim.now()).toBe(26)
  })
})
