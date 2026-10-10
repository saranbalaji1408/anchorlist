import { elementScroller, HORIZONTAL, type ElementScrollerOptions, type Scroller } from './scroller'

/**
 * How the browser reports `scrollLeft` in a right-to-left container:
 * - 0 (`negative`, the standard; current Chromium, WebKit and Firefox): 0 at
 *   the start (right), negative towards the left;
 * - 1 (`reverse`, legacy Edge): 0 at the start, positive towards the left;
 * - 2 (`default`, Chromium before 85 and older WebKit): the maximum at the
 *   start, 0 at the left end.
 */
export type RtlConvention = 0 | 1 | 2

/** Detects the browser's right-to-left `scrollLeft` convention with a throwaway element. */
export function rtlConvention(): RtlConvention {
  const probe = document.createElement('div')
  probe.style.cssText = 'direction:rtl;overflow:hidden;position:absolute;visibility:hidden;width:2px;height:1px'
  probe.innerHTML = '<div style="width:4px;height:1px"></div>'
  document.body.appendChild(probe)
  let convention: RtlConvention = 2
  if (probe.scrollLeft <= 0) {
    probe.scrollLeft = 1
    convention = probe.scrollLeft > 0 ? 1 : 0
  }
  probe.remove()
  return convention
}

/**
 * Creates a {@link Scroller} for a horizontal list in a right-to-left scroll
 * container (`direction: rtl`): the start edge is the right edge, rows run
 * leftwards and the scroll offset grows towards the left in every browser
 * (`scrollLeft` is normalised for all three browser conventions, detected once
 * per call). A left-to-right container gets a plain horizontal
 * `elementScroller`, so this can be used for any horizontal list. The
 * direction is read at creation; create a new scroller (re-attach) when it
 * changes. `axis` is ignored.
 */
export function rtlScroller(options: ElementScrollerOptions): Scroller<Element> {
  const { element: el, list } = options
  if (getComputedStyle(el).direction !== 'rtl') return elementScroller({ ...options, axis: HORIZONTAL })
  const rtl = elementScroller({ ...options, axis: { ...HORIZONTAL, padStart: 'paddingRight', padEnd: 'paddingLeft' } })
  const convention = rtlConvention()
  const sign = convention === 1 ? 1 : -1
  // Raw `scrollLeft` at the start edge.
  const zero = (): number => (convention > 1 ? el.scrollWidth - el.clientWidth : 0)
  const offset = (): number => sign * (el.scrollLeft - zero())
  const right = (e: Element): number => e.getBoundingClientRect().right
  return {
    ...rtl,
    offset,
    setOffset(v) {
      el.scrollLeft = sign * v + zero()
    },
    overscrolled: () => Math.min(offset(), 0) || Math.max(offset() + el.clientWidth - el.scrollWidth, 0),
    measure(e) {
      return { start: right(el) - right(e), size: e.getBoundingClientRect().width }
    },
    listStart: () => right(el) - right(list),
    // Positive values move content towards the end (left).
    translate: (px) => rtl.translate(-px),
  }
}
