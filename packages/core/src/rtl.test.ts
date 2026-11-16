import { afterEach, describe, expect, it, vi } from 'vitest'
import { rtlConvention, rtlScroller, type RtlConvention } from './rtl'

/**
 * A right-to-left scroll container whose `scrollLeft` follows `convention`.
 * Content is 1000 px wide in a 300 px viewport (max scroll 700); `pos` is the
 * normalised distance from the right edge.
 */
const fakeScroller = (convention: RtlConvention, right = 400) => {
  let pos = 0
  const max = 700
  return {
    clientWidth: 300,
    clientHeight: 200,
    scrollWidth: 1000,
    scrollHeight: 200,
    get scrollLeft(): number {
      return convention === 0 ? -pos : convention === 1 ? pos : max - pos
    },
    set scrollLeft(v: number) {
      // Browsers allow overscroll here only through rubber-banding; tests set it directly.
      pos = convention === 0 ? -v : convention === 1 ? v : max - v
    },
    get pos(): number {
      return pos
    },
    style: {} as Record<string, string>,
    getBoundingClientRect: () => ({ top: 0, left: right - 300, right, width: 300, height: 200 }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
}

const fakeBox = (right: number, width = 0) => ({
  style: {} as Record<string, string>,
  getBoundingClientRect: () => ({ top: 0, left: right - width, right, width, height: 0 }),
})

/** Stubs the DOM so that `rtlConvention()` detects `convention` and every element is `direction`. */
const stubDom = (convention: RtlConvention, direction = 'rtl', body = true) => {
  vi.stubGlobal('getComputedStyle', () => ({ direction }))
  const parents: string[] = []
  const append = (name: string) => () => void parents.push(name)
  vi.stubGlobal('document', {
    createElement: () => {
      // The probe is 2 px wide with 4 px of content: max scroll 2.
      let pos = 0
      return {
        style: {},
        // Markup is refused, as under Trusted Types.
        set innerHTML(_: string) {
          throw new TypeError('This document requires TrustedHTML assignment.')
        },
        appendChild: (child: unknown) => child,
        get scrollLeft(): number {
          return convention === 0 ? -pos : convention === 1 ? pos : 2 - pos
        },
        set scrollLeft(v: number) {
          const p = convention === 0 ? -v : convention === 1 ? v : 2 - v
          pos = Math.min(Math.max(p, 0), 2)
        },
        remove: () => undefined,
      }
    },
    body: body ? { appendChild: append('body') } : null,
    documentElement: { appendChild: append('html') },
  })
  return parents
}

describe('rtlConvention', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('detects all three conventions', () => {
    for (const c of [0, 1, 2] as const) {
      stubDom(c)
      expect(rtlConvention()).toBe(c)
    }
  })

  it('builds the probe without markup and uses the document element when there is no body yet', () => {
    const inBody = stubDom(0)
    expect(rtlConvention()).toBe(0)
    expect(inBody).toEqual(['body'])
    const parents = stubDom(1, 'rtl', false)
    expect(rtlConvention()).toBe(1)
    expect(parents).toEqual(['html'])
  })
})

describe('rtlScroller', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('normalises scrollLeft to grow from the right edge in every convention', () => {
    for (const c of [0, 1, 2] as const) {
      stubDom(c)
      const el = fakeScroller(c)
      const list = fakeBox(390)
      const sc = rtlScroller({ element: el as never, list: list as never })
      expect(sc.offset(), `convention ${c}`).toBeCloseTo(0)
      sc.setOffset(250)
      expect(el.pos, `convention ${c}`).toBe(250)
      expect(sc.offset(), `convention ${c}`).toBe(250)
      expect(sc.overscrolled()).toBe(0)
      sc.setOffset(-20)
      expect(sc.overscrolled(), `convention ${c}`).toBe(-20)
      sc.setOffset(730)
      expect(sc.overscrolled(), `convention ${c}`).toBe(30)
      expect(sc.viewport()).toBe(300)
      expect(sc.crossSize()).toBe(200)
      expect(sc.scrollSize()).toBe(1000)
    }
  })

  it('measures from the right edge and mirrors spacers and transforms', () => {
    stubDom(0)
    const el = fakeScroller(0, 400)
    const list = fakeBox(390)
    const content = fakeBox(395)
    const sc = rtlScroller({ element: el as never, list: list as never, content: content as never })
    // A 120 px row whose right edge is 50 px left of the viewport's right edge.
    expect(sc.measure(fakeBox(350, 120) as never)).toEqual({ start: 50, size: 120 })
    expect(sc.listStart()).toBe(10)
    sc.setSpacers(100, 40)
    expect(list.style).toEqual({ paddingRight: '100px', paddingLeft: '40px' })
    // A positive shift moves content towards the end, which is to the left.
    sc.translate(12)
    expect(content.style.transform).toBe('translateX(-12px)')
    sc.translate(0)
    expect(content.style.transform).toBe('')
  })

  it('is a plain horizontal scroller in a left-to-right container', () => {
    stubDom(0, 'ltr')
    const el = { ...fakeScroller(1), scrollLeft: 0, getBoundingClientRect: () => ({ left: 10, right: 310, top: 0 }) }
    const list = { style: {} as Record<string, string>, getBoundingClientRect: () => ({ left: 30, top: 0 }) }
    const sc = rtlScroller({ element: el as never, list: list as never })
    sc.setOffset(50)
    expect(el.scrollLeft).toBe(50)
    expect(sc.listStart()).toBe(20)
    sc.setSpacers(5, 6)
    expect(list.style).toEqual({ paddingLeft: '5px', paddingRight: '6px' })
  })
})
