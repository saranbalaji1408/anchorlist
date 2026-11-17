import { expect, expectFramework, still, test } from '../src/harness'

/**
 * 100k items through the framework adapter, timed in the page (framework
 * render + engine; the engine alone is benchmarked in packages/core). The
 * update budgets are relative to a 10k list in the same page, so they catch
 * O(n) regressions rather than machine load.
 */
const N = 100_000
/** Items, cycles of 100 updates and growth limit (bytes) of the heap check. */
const HEAP_N = 10_000
const HEAP_CYCLES = 3
const HEAP_LIMIT = 512 * 1024

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

    // Heap over prepend + trim cycles at a constant count (Chromium exposes the heap). A 10k list
    // reaches a steady state quickly: once every mounted item has been trimmed, each cycle replaces
    // items with items of the same shape, so the heap must stay flat. Anything that keeps trimmed
    // items (an id-keyed cache that never evicts) grows by every prepended item.
    if (browserName !== 'chromium') return
    // Vue development builds keep about 22 MB per 100 updates past a forced GC (65 MB over the
    // measured cycles), which later collections release, so on Vue the check runs on the
    // production build of the same fixture (served at `/vue-prod/`): 75-350 KB, as on React.
    if (test.info().project.name.endsWith('-vue')) {
      // A 404 fails here at once, rather than after the driver wait times out.
      expect((await page.goto('../vue-prod/'))?.status(), 'vue-prod is built').toBe(200)
      await page.waitForFunction(() => typeof window.__driver?.mount === 'function')
      await expectFramework(page)
    }
    const cdp = await page.context().newCDPSession(page)
    const heap = async (): Promise<number> => {
      await cdp.send('HeapProfiler.collectGarbage')
      return (await cdp.send('Runtime.getHeapUsage')).usedSize
    }
    await page.evaluate(async (n) => {
      const w = window as unknown as { __list?: { id: string; height: number }[] }
      w.__list = Array.from({ length: n }, (_, i) => ({ id: `h${i}`, height: 30 + (i % 9) * 10 }))
      await window.__driver.mount({ items: w.__list })
    }, HEAP_N)
    /** 100 updates, each prepending 50 items and trimming 50 from the end. */
    const cycle = (): Promise<void> =>
      page.evaluate(async () => {
        const w = window as unknown as { __list: { id: string; height: number }[]; __next?: number }
        let list = w.__list
        for (let r = 0; r < 100; r++) {
          const next = (w.__next = (w.__next ?? 0) + 1)
          list = [...Array.from({ length: 50 }, (_, i) => ({ id: `c${next}-${i}`, height: 40 })), ...list.slice(0, list.length - 50)]
          await window.__driver.update({ items: list })
        }
        w.__list = list
      })
    // Warm up until every mounted item is trimmed (JIT, caches, the engine's tables).
    for (let c = 0; c < (HEAP_N / 5000) + 1; c++) await cycle()
    const before = await heap()
    for (let c = 0; c < HEAP_CYCLES; c++) await cycle()
    const after = await heap()
    // Measured on the React fixture in Chromium: flat 165-186 KB (JIT code), while keeping every
    // trimmed item (an intern table or render counter that never evicts) adds 1.44-1.45 MB.
    expect(after - before).toBeLessThan(HEAP_LIMIT)
  })
})
