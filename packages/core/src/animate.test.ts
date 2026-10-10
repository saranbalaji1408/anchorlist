import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animateToKey } from './animate'
import { keysOf, mount, type Harness } from './test/harness'
import type { Key } from './types'

const VIEWPORT = 500

/** A scroll container element backed by the harness's simulated scroller. */
function element(h: Harness): HTMLElement & { fire(type: string): void } {
  const listeners = new Map<string, Set<() => void>>()
  return {
    get scrollTop() {
      return h.sim.offset()
    },
    set scrollTop(v: number) {
      h.sim.setOffset(v)
    },
    get clientHeight() {
      return h.sim.viewport()
    },
    get scrollHeight() {
      return h.sim.scrollSize()
    },
    addEventListener(type: string, fn: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn)
    },
    isConnected: true,
    fire(type: string) {
      listeners.get(type)?.forEach((fn) => fn())
    },
    listeners,
  } as unknown as HTMLElement & { fire(type: string): void }
}

let now = 0
let callbacks: Array<(t: number) => void> = []
let reduced = false

beforeEach(() => {
  now = 0
  callbacks = []
  reduced = false
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => callbacks.push(cb))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    callbacks[id - 1] = () => undefined
  })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduced && q.includes('reduce') }))
})
afterEach(() => vi.unstubAllGlobals())

/** Runs animation frames (16 ms apart) until none is pending, settling the engine after each. Returns the offsets. */
async function run(h: Harness, max = 200): Promise<number[]> {
  const offsets: number[] = []
  for (let i = 0; i < max; i++) {
    const pending = callbacks.splice(0)
    if (!pending.length) break
    now += 16
    pending.forEach((cb) => cb(now))
    offsets.push(h.sim.offset())
    await h.settle(1)
  }
  await h.settle()
  return offsets
}

/** Sizes that the 48 px default estimate gets wrong, so the target moves while rows are measured on the way. */
const size = (k: Key): number => 30 + (Number(String(k).slice(1)) % 7) * 20

describe('animateToKey', () => {
  for (const align of ['start', 'center', 'end'] as const) {
    it(`reaches an unmounted row exactly and smoothly (align ${align})`, async () => {
      const h = mount({ keys: keysOf(3000), size, viewport: VIEWPORT })
      await h.settle()
      const key = h.keys[2000]!
      expect(h.mounted.has(key)).toBe(false)
      const done = animateToKey(h.v, element(h), key, { align, duration: 300 })
      const offsets = await run(h)
      await expect(done).resolves.toBe(true)
      // Many frames, moving monotonically towards the target.
      expect(offsets.length).toBeGreaterThan(10)
      for (let i = 1; i < offsets.length; i++) expect(offsets[i]!).toBeGreaterThanOrEqual(offsets[i - 1]!)
      const top = h.visualStart(key)!
      const expected = align === 'start' ? 0 : align === 'end' ? VIEWPORT - size(key) : (VIEWPORT - size(key)) / 2
      expect(Math.abs(top - expected)).toBeLessThanOrEqual(0.5)
    })
  }

  it('animates upwards and applies the offset option', async () => {
    const h = mount({ keys: keysOf(3000), size, viewport: VIEWPORT, options: { align: 'end' } })
    await h.settle()
    const key = h.keys[100]!
    const done = animateToKey(h.v, element(h), key, { offset: -40 })
    await run(h)
    await expect(done).resolves.toBe(true)
    expect(h.visualStart(key)).toBeCloseTo(40, 0)
  })

  it('is cancelled by user input, by a signal and by a newer animation', async () => {
    const h = mount({ keys: keysOf(3000), size, viewport: VIEWPORT })
    await h.settle()
    const el = element(h)
    const first = animateToKey(h.v, el, h.keys[2000]!)
    await run(h, 3)
    el.fire('wheel')
    await expect(first).resolves.toBe(false)
    const at = h.sim.offset()
    await run(h)
    expect(h.sim.offset()).toBe(at)

    const controller = new AbortController()
    const second = animateToKey(h.v, el, h.keys[2000]!, { signal: controller.signal })
    await run(h, 2)
    controller.abort()
    await expect(second).resolves.toBe(false)

    const third = animateToKey(h.v, el, h.keys[2000]!)
    const fourth = animateToKey(h.v, el, h.keys[10]!)
    await expect(third).resolves.toBe(false)
    await run(h)
    await expect(fourth).resolves.toBe(true)
    expect(h.visualStart(h.keys[10]!)).toBeCloseTo(0, 0)
  })

  it('jumps at once with prefers-reduced-motion or duration 0, and rejects unknown keys', async () => {
    const h = mount({ keys: keysOf(3000), size, viewport: VIEWPORT })
    await h.settle()
    await expect(animateToKey(h.v, element(h), 'nope')).resolves.toBe(false)
    reduced = true
    await expect(animateToKey(h.v, element(h), h.keys[1500]!)).resolves.toBe(true)
    expect(callbacks.length).toBe(0)
    await h.settle()
    expect(h.visualStart(h.keys[1500]!)).toBeCloseTo(0, 0)
    reduced = false
    await expect(animateToKey(h.v, element(h), h.keys[10]!, { duration: 0 })).resolves.toBe(true)
    await h.settle()
    expect(h.visualStart(h.keys[10]!)).toBeCloseTo(0, 0)
  })

  it('resolves false and stops writing when the container is detached (the list unmounted)', async () => {
    const h = mount({ keys: keysOf(3000), size, viewport: VIEWPORT })
    await h.settle()
    const el = element(h)
    const done = animateToKey(h.v, el, h.keys[2000]!)
    await run(h, 3)
    ;(el as unknown as { isConnected: boolean }).isConnected = false
    const at = h.sim.offset()
    await run(h)
    await expect(done).resolves.toBe(false)
    expect(h.sim.offset()).toBe(at)
  })

  it('resolves false when the key is removed on the way', async () => {
    const h = mount({ keys: keysOf(3000), size, viewport: VIEWPORT })
    await h.settle()
    const key = h.keys[2000]!
    const done = animateToKey(h.v, element(h), key)
    await run(h, 3)
    h.setKeys(h.keys.filter((k) => k !== key))
    await run(h)
    await expect(done).resolves.toBe(false)
  })
})
