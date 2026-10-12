import { expect, still, test } from '../src/harness'

/**
 * 100k items through the framework adapter, timed in the page (framework
 * render + engine; the engine alone is benchmarked in packages/core). The
 * update budgets are relative to a 10k list in the same page, so they catch
 * O(n) regressions rather than machine load.
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
    /** Mounts `n` items. Returns the time to the mounted list, in ms. */
    const mount = (n: number): Promise<number> =>
      page.evaluate(async (n) => {
        const items = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, height: 30 + (i % 9) * 10 }))
        const t = performance.now()
        await window.__driver.mount({ items })
        return performance.now() - t
      }, n)
    /** 20 50-item prepends while anchored (sync updates, each committed before it returns). Returns their times. */
    const prepend = (n: number): Promise<number[]> =>
      page.evaluate(async (n) => {
        let list = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, height: 30 + (i % 9) * 10 }))
        const times: number[] = []
        for (let r = 0; r < 20; r++) {
          list = [...Array.from({ length: 50 }, (_, i) => ({ id: `p${r}-${i}`, height: 40 })), ...list]
          const t = performance.now()
          await window.__driver.update({ items: list })
          // The render and commit only: the fixture's own O(n) item preparation is not the library's.
          times.push(window.__driver.lastUpdateMs?.() ?? performance.now() - t)
          await new Promise((res) => requestAnimationFrame(res))
        }
        return times
      }, n)
    /** 100 streaming updates: the newest item grows, as a token stream would. Returns their times. */
    const stream = (n: number): Promise<number[]> =>
      page.evaluate(async (n) => {
        const times: number[] = []
        for (let i = 0; i < 100; i++) {
          const t = performance.now()
          window.__driver.setItemHeight(`m${n - 1}`, 100 + i)
          times.push(performance.now() - t)
        }
        return times
      }, n)

    // Absolute times depend on machine load, so updates are budgeted against the same work on a
    // 10k list in the same page: costs that grow with the list (O(n) per update) show up as ~10x.
    await mount(N / 10)
    const small = { prepend: median(await prepend(N / 10)), stream: median(await stream(N / 10)) }

    const mountMs = await mount(N)
    expect(mountMs).toBeLessThan(2000)
    expect((await d.mountedKeys()).length).toBeLessThan(80)
    const anchor = await d.rowAt(300)
    let prepends: number[] = []
    await still(d, [`top:${anchor}`], async () => {
      prepends = await prepend(N)
    })
    const large = { prepend: median(prepends), stream: median(await stream(N)) }
    test.info().annotations.push({ type: 'perf', description: JSON.stringify({ mountMs, small, large }) })
    // At most 3x the 10k cost (plus 2 ms for timer resolution), and a sanity ceiling.
    expect(large.prepend).toBeLessThan(3 * small.prepend + 2)
    expect(large.stream).toBeLessThan(3 * small.stream + 2)
    expect(large.prepend).toBeLessThan(200)
    expect(large.stream).toBeLessThan(50)

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
