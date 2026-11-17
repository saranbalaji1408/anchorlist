import { describe, expect, it } from 'vitest'
import { keysOf, mount } from './test/harness'
import type { Key } from './types'

/**
 * Engine micro-benchmarks at 100k items on the simulated scroller. Opt-in:
 * `pnpm --filter @anchorlist/core bench` (sets BENCH=1). Times include the
 * minimal test host (rendering ~30 rows), not a framework.
 */
declare const process: { env: Record<string, string | undefined>; memoryUsage(): { heapUsed: number } }
declare const performance: { now(): number }
const gc = (globalThis as { gc?: () => void }).gc

const N = 100_000
const sized = (key: Key): number => 40 + (Number(String(key).slice(1)) % 9) * 15

const stats = (samples: number[]): { mean: number; p50: number; p95: number } => {
  const sorted = [...samples].sort((a, b) => a - b)
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!
  return { mean: samples.reduce((a, b) => a + b, 0) / samples.length, p50: at(0.5), p95: at(0.95) }
}
const us = (ms: number): string => `${(ms * 1000).toFixed(1)} µs`

describe.skipIf(!process.env.BENCH)('engine perf (100k items)', () => {
  it('reports mount, streaming, prepend, scroll and heap numbers', async () => {
    const lines: string[] = []
    const report = (name: string, value: string): void => void lines.push(`${name.padEnd(34)} ${value}`)

    let t = performance.now()
    const h = mount({ keys: keysOf(N), size: sized, viewport: 800, options: { align: 'end' } })
    report('mount (to first settled frame)', `${(performance.now() - t).toFixed(2)} ms`)
    await h.settle()

    // Streaming: same keys, the last item grows (a token stream into the newest message).
    const stream: number[] = []
    const last = h.keys[N - 1]!
    const keys = h.keys
    for (let i = 0; i < 5000; i++) {
      h.resize(last, 100 + (i % 50))
      t = performance.now()
      h.setKeys(keys)
      h.sim.tick()
      stream.push(performance.now() - t)
    }
    const s = stats(stream)
    report('streaming update (plan+commit+RO)', `mean ${us(s.mean)}, p50 ${us(s.p50)}, p95 ${us(s.p95)}`)

    // Scroll frames.
    h.sim.userScroll(h.sim.offset() - 20_000)
    await h.settle()
    const frames: number[] = []
    for (let i = 0; i < 2000; i++) {
      h.sim.userScroll(h.sim.offset() - 37)
      t = performance.now()
      h.sim.tick()
      frames.push(performance.now() - t)
    }
    const f = stats(frames)
    report('scroll frame (37 px/frame)', `p50 ${us(f.p50)}, p95 ${us(f.p95)}`)

    // 50-item prepends while anchored.
    const prepend: number[] = []
    let next = 0
    for (let i = 0; i < 200; i++) {
      const added = Array.from({ length: 50 }, () => `p${next++}`)
      const list = [...added, ...h.keys]
      t = performance.now()
      h.setKeys(list)
      h.sim.tick()
      prepend.push(performance.now() - t)
    }
    const p = stats(prepend)
    report('50-item prepend', `p50 ${us(p.p50)}, p95 ${us(p.p95)}`)

    // Heap over 100 prepend + trim cycles at a constant count.
    gc?.()
    const heapBefore = process.memoryUsage().heapUsed
    for (let i = 0; i < 100; i++) {
      const added = Array.from({ length: 50 }, () => `c${next++}`)
      h.setKeys([...added, ...h.keys.slice(0, h.keys.length - 50)])
      h.sim.tick()
    }
    gc?.()
    const heapAfter = process.memoryUsage().heapUsed
    report('heap after 100 prepend/trim cycles', `${((heapAfter - heapBefore) / 1024).toFixed(0)} KiB delta${gc ? '' : ' (no --expose-gc, noisy)'}`)
    report('items', String(h.keys.length))

    // Idle work once updates stop: the first run also refreshes estimates, later runs only validate keys.
    h.setKeys([...h.keys])
    t = performance.now()
    h.sim.advance(400)
    report('idle: estimate refresh + validation', `${(performance.now() - t).toFixed(2)} ms`)
    h.setKeys([...h.keys])
    t = performance.now()
    h.sim.advance(400)
    report('idle: full key validation', `${(performance.now() - t).toFixed(2)} ms`)

    // A middle insert falls back to a rebuild.
    const middle = [...h.keys]
    middle.splice(N / 2, 0, 'middle')
    t = performance.now()
    h.setKeys(middle)
    report('middle insert (rebuild)', `${(performance.now() - t).toFixed(2)} ms`)

    const text = lines.join('\n') + '\n'
    if (process.env.BENCH_OUT) {
      const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { writeFileSync(file: string, text: string): void }
      fs.writeFileSync(process.env.BENCH_OUT, text)
    } else console.log('\n' + text)
    expect(s.p50).toBeLessThan(0.05)
  }, 120_000)
})
