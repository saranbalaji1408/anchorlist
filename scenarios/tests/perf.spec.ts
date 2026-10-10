import { expect, still, test } from '../src/harness'

/**
 * 100k items through the framework adapter, timed in the page (framework
 * render + engine; the engine alone is benchmarked in packages/core). The
 * budgets are loose: they catch O(n) regressions, not small slowdowns.
 */
const N = 100_000

test.describe('100k items', () => {
  test.describe.configure({ timeout: 120_000 })
  // React 19 development builds in Chromium (where console.timeStamp exists) diff
  // every changed prop for the Performance panel's component track; for a
  // 100k-item array that is O(n) per render and dominates the timings. It is
  // development-only and not this library's cost, so these timings run without it.

  test('mounts, prepends, streams and keeps the heap flat', async ({ d, page, browserName }) => {
    const median = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
    await page.addInitScript(() => {
      delete (console as { timeStamp?: unknown }).timeStamp
    })
    await page.reload()
    await page.waitForFunction(() => typeof window.__driver?.mount === 'function')
    const mountMs = await page.evaluate(async (n) => {
      const items = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, height: 30 + (i % 9) * 10 }))
      const t = performance.now()
      await window.__driver.mount({ items })
      return performance.now() - t
    }, N)
    expect(mountMs).toBeLessThan(2000)
    expect((await d.mountedKeys()).length).toBeLessThan(80)

    // 50-item prepends while anchored (sync updates, each committed before it returns).
    const anchor = await d.rowAt(300)
    let prepends: number[] = []
    await still(d, [`top:${anchor}`], async () => {
      prepends = await page.evaluate(async (n) => {
        const base = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, height: 30 + (i % 9) * 10 }))
        let list = base
        const times: number[] = []
        for (let r = 0; r < 20; r++) {
          list = [...Array.from({ length: 50 }, (_, i) => ({ id: `p${r}-${i}`, height: 40 })), ...list]
          const t = performance.now()
          await window.__driver.update({ items: list })
          times.push(performance.now() - t)
          await new Promise((res) => requestAnimationFrame(res))
        }
        return times
      }, N)
    })
    expect(median(prepends)).toBeLessThan(30)

    // Streaming: the newest item grows, as a token stream would.
    const stream = await page.evaluate(async (n) => {
      const times: number[] = []
      for (let i = 0; i < 100; i++) {
        const t = performance.now()
        window.__driver.setItemHeight(`m${n - 1}`, 100 + i)
        times.push(performance.now() - t)
      }
      return times
    }, N)
    expect(median(stream)).toBeLessThan(5)

    // Heap over 100 prepend + trim cycles at a constant count (Chromium exposes the heap).
    if (browserName !== 'chromium') return
    const cdp = await page.context().newCDPSession(page)
    const heap = async (): Promise<number> => {
      await cdp.send('HeapProfiler.collectGarbage')
      return (await cdp.send('Runtime.getHeapUsage')).usedSize
    }
    const cycle = (): Promise<void> =>
      page.evaluate(async (n) => {
        const w = window as unknown as { __list?: { id: string; height: number }[]; __next?: number }
        let list = w.__list ?? Array.from({ length: n }, (_, i) => ({ id: `m${i}`, height: 30 + (i % 9) * 10 }))
        for (let r = 0; r < 100; r++) {
          const next = (w.__next = (w.__next ?? 0) + 1)
          list = [...Array.from({ length: 50 }, (_, i) => ({ id: `c${next}-${i}`, height: 40 })), ...list.slice(0, list.length - 50)]
          await window.__driver.update({ items: list })
        }
        w.__list = list
      }, N)
    await cycle() // warm up (JIT, caches, interned items)
    const before = await heap()
    await cycle()
    const after = await heap()
    // The item array itself is ~100k objects; growth per 100 cycles must stay far below one copy of it.
    expect(after - before).toBeLessThan(4 * 1024 * 1024)
  })
})
