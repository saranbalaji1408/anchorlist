import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AnchorList, useAnchorList } from './index'

// Layout effects do not run on the server, so these check the render phase
// only. Mounting, anchoring and scrolling are covered by the scenarios.

const items = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}` }))
const renderItem = (item: { id: string }): ReactNode => item.id

describe('AnchorList (render phase)', () => {
  it('renders the container, header, list and footer but no rows before attach', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorList<{ id: string }>, {
        items,
        getKey: (m) => m.id,
        renderItem,
        align: 'end',
        gap: 4,
        header: createElement('header', null, 'top'),
        footer: createElement('footer', null, 'bottom'),
        sticky: (r) => `pill:${r.endIndex}`,
        className: 'sc',
        scrollerProps: { id: 'list', 'aria-label': 'Messages' },
      }),
    )
    expect(html).toContain('id="list"')
    expect(html).toContain('aria-label="Messages"')
    expect(html).toContain('class="sc"')
    expect(html).toContain('overflow-y:auto;overflow-anchor:none')
    expect(html).toContain('pill:-1')
    expect(html).toMatch(/<header>top<\/header><div role="list" style="display:flex;flex-direction:column;gap:4px"><\/div><footer>bottom<\/footer>/)
    expect(html).not.toContain('data-key')
  })

  it('lets the scroller style extend the defaults', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorList<{ id: string }>, { items, getKey: (m) => m.id, renderItem, style: { height: 300 } }),
    )
    expect(html).toContain('overflow-y:auto;overflow-anchor:none;height:300px')
  })
})

describe('useAnchorList (render phase)', () => {
  it('returns a stable virtualizer and an empty plan before attach', () => {
    let plan: unknown
    let calls = 0
    function Probe(): ReactNode {
      const [v, p] = useAnchorList({ count: 10, getKey: (i) => i }, () => {
        calls++
        return null
      })
      plan = p
      expect(typeof v.scrollToKey).toBe('function')
      return null
    }
    renderToStaticMarkup(createElement(Probe))
    expect(plan).toMatchObject({ start: 0, end: -1 })
    expect(calls).toBe(0)
  })
})
