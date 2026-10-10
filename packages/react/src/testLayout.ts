/**
 * A tiny vertical layout for DOM unit tests (happy-dom has no layout engine).
 * Test-only; not exported from the package.
 *
 * - The scroll container (`#sc`) is `viewport` px tall and 400 px wide.
 * - The list (`[role="list"]`) holds its rows (`[role="listitem"]`) stacked
 *   without gaps between its padding, which the engine writes.
 * - A row is `size(key)` px tall (default 50). Header and footer are ignored.
 * - `scrollTop` is clamped to `[0, scrollHeight - viewport]`, like a browser.
 */

export interface TestLayout {
  /** Viewport height in px. */
  viewport: number
  /** Row sizes by `data-key`; missing keys are 50 px. */
  sizes: Map<string, number>
  /** Number of live ResizeObservers. */
  observers(): number
  /** Restores the patched prototypes. */
  restore(): void
}

const px = (v: string): number => parseFloat(v) || 0

/** Installs the layout. Call `restore()` after the test. */
export function installLayout(): TestLayout {
  const proto = HTMLElement.prototype
  const saved = new Map<string, PropertyDescriptor | undefined>()
  const offsets = new WeakMap<Element, number>()
  let live = 0
  const layout: TestLayout = {
    viewport: 600,
    sizes: new Map(),
    observers: () => live,
    restore() {
      for (const [name, d] of saved) {
        if (d) Object.defineProperty(proto, name, d)
        else delete (proto as unknown as Record<string, unknown>)[name]
      }
      globalThis.ResizeObserver = OriginalRO
    },
  }

  const isScroller = (el: Element): boolean => el.id === 'sc'
  const list = (sc: Element): HTMLElement | null => sc.querySelector('[role="list"]')
  const rowSize = (el: Element): number => layout.sizes.get(el.getAttribute('data-key') ?? '') ?? 50
  const rowsOf = (l: HTMLElement): Element[] => Array.from(l.children)
  const content = (sc: Element): number => {
    const l = list(sc)
    if (!l) return 0
    return px(l.style.paddingTop) + px(l.style.paddingBottom) + rowsOf(l).reduce((s, r) => s + rowSize(r), 0)
  }
  const scrollerOf = (el: Element): Element | null => el.closest('#sc')
  const offset = (sc: Element): number => offsets.get(sc) ?? 0

  const define = (name: string, d: PropertyDescriptor): void => {
    saved.set(name, Object.getOwnPropertyDescriptor(proto, name))
    Object.defineProperty(proto, name, { configurable: true, ...d })
  }
  define('clientHeight', { get(this: Element) { return isScroller(this) ? layout.viewport : 0 } })
  define('clientWidth', { get(this: Element) { return isScroller(this) ? 400 : 0 } })
  define('scrollHeight', { get(this: Element) { return isScroller(this) ? Math.max(layout.viewport, content(this)) : 0 } })
  define('scrollTop', {
    get(this: Element) { return offset(this) },
    set(this: Element, v: number) {
      if (isScroller(this)) offsets.set(this, Math.min(Math.max(0, v), Math.max(0, content(this) - layout.viewport)))
    },
  })
  define('getBoundingClientRect', {
    value(this: Element) {
      const rect = (top: number, height: number): DOMRect =>
        ({ top, height, bottom: top + height, left: 0, right: 400, width: 400, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
      if (isScroller(this)) return rect(0, layout.viewport)
      const sc = scrollerOf(this)
      const l = sc && list(sc)
      if (!sc || !l) return rect(0, 0)
      const top = -offset(sc)
      if (this === l) return rect(top, content(sc))
      let y = top + px(l.style.paddingTop)
      for (const r of rowsOf(l)) {
        if (r === this || r.contains(this)) return rect(y, rowSize(r))
        y += rowSize(r)
      }
      return rect(0, 0)
    },
  })

  const OriginalRO = globalThis.ResizeObserver
  globalThis.ResizeObserver = class {
    constructor() {
      live++
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {
      live--
    }
  } as unknown as typeof ResizeObserver
  return layout
}
