import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createKeyMap, NO_CHANGE, type KeyMap } from './keyMap'
import type { Key } from './types'

const load = (keys: Key[]): KeyMap => {
  const map = createKeyMap()
  map.apply(map.diff(keys.length, (i) => keys[i]!), keys.length, (i) => keys[i]!, () => 0, () => {})
  return map
}

/** Applies `next` to a map holding `prev` and checks every invariant. */
const step = (map: KeyMap, prev: Key[], next: Key[]): { removed: Key[]; diff: ReturnType<KeyMap['diff']> } => {
  const getKey = (i: number): Key => next[i]!
  const diff = map.diff(next.length, getKey)
  const removed: Key[] = []
  map.apply(diff, next.length, getKey, (i) => prev[i]!, (k) => removed.push(k))
  return { removed, diff }
}

let id = 0
const fresh = (n: number): Key[] => Array.from({ length: n }, () => `f${id++}`)

type Change =
  | { t: 'prepend' | 'append'; k: number }
  | { t: 'trimStart' | 'trimEnd'; k: number }
  | { t: 'trimAppend' | 'trimPrepend'; trim: number; add: number }
  | { t: 'insert' | 'remove'; at: number; k: number }
  | { t: 'swap'; at: number }
  | { t: 'replace'; k: number }

const change: fc.Arbitrary<Change> = fc.oneof(
  fc.record({ t: fc.constantFrom('prepend' as const, 'append' as const, 'trimStart' as const, 'trimEnd' as const), k: fc.nat(8) }),
  fc.record({ t: fc.constantFrom('trimAppend' as const, 'trimPrepend' as const), trim: fc.nat(8), add: fc.nat(8) }),
  fc.record({ t: fc.constantFrom('insert' as const, 'remove' as const), at: fc.nat(100), k: fc.integer({ min: 1, max: 3 }) }),
  fc.record({ t: fc.constant('swap' as const), at: fc.nat(100) }),
  fc.record({ t: fc.constant('replace' as const), k: fc.nat(20) }),
)

const next = (prev: Key[], c: Change): Key[] => {
  const n = prev.length
  switch (c.t) {
    case 'prepend':
      return [...fresh(c.k), ...prev]
    case 'append':
      return [...prev, ...fresh(c.k)]
    case 'trimStart':
      return prev.slice(Math.min(c.k, n))
    case 'trimEnd':
      return prev.slice(0, Math.max(0, n - c.k))
    case 'trimAppend':
      return [...prev.slice(Math.min(c.trim, n)), ...fresh(c.add)]
    case 'trimPrepend':
      return [...fresh(c.add), ...prev.slice(0, Math.max(0, n - c.trim))]
    case 'insert': {
      const at = c.at % (n + 1)
      return [...prev.slice(0, at), ...fresh(c.k), ...prev.slice(at)]
    }
    case 'remove': {
      const at = c.at % Math.max(1, n)
      return [...prev.slice(0, at), ...prev.slice(at + c.k)]
    }
    case 'swap': {
      if (n < 2) return prev
      const at = c.at % (n - 1)
      const out = [...prev]
      ;[out[at], out[at + 1]] = [out[at + 1]!, out[at]!]
      return out
    }
    case 'replace':
      return fresh(c.k)
  }
}

describe('KeyMap', () => {
  it('tracks every edit exactly, using validate + rebuild as the fallback (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), fc.array(change, { maxLength: 40 }), (n0, changes) => {
        let keys = fresh(n0)
        const map = load(keys)
        for (const c of changes) {
          const after = next(keys, c)
          const { removed, diff } = step(map, keys, after)
          // Lazy validation: a middle change the edge diff cannot see is caught here and rebuilt.
          if (!map.validate(0, after.length - 1, (i) => after[i]!)) {
            expect(diff.rebuild).toBe(false)
            map.apply({ ...NO_CHANGE, rebuild: true }, after.length, (i) => after[i]!, (i) => keys[i]!, () => {})
          }
          const gone = new Set(after)
          expect(removed.every((k) => !gone.has(k))).toBe(true)
          expect(map.count).toBe(after.length)
          after.forEach((k, i) => expect(map.indexOf(k)).toBe(i))
          keys = after
        }
        expect(map.indexOf('missing')).toBe(-1)
      }),
      { numRuns: 400 },
    )
  })

  it('classifies edge changes in O(k) and streaming as NO_CHANGE', () => {
    const keys = Array.from({ length: 100 }, (_, i) => `k${i}`)
    const map = load(keys)
    let calls = 0
    const counted = (list: Key[]) => (i: number): Key => {
      calls++
      return list[i]!
    }
    expect(map.diff(100, counted(keys))).toBe(NO_CHANGE)
    expect(calls).toBe(2)

    calls = 0
    const prepended = ['a', 'b', 'c', ...keys]
    expect(map.diff(103, counted(prepended))).toEqual({ trimStart: 0, trimEnd: 0, prepend: 3, append: 0, rebuild: false })
    expect(calls).toBeLessThanOrEqual(6)

    calls = 0
    const slid = [...keys.slice(5), 'x', 'y']
    expect(map.diff(97, counted(slid))).toEqual({ trimStart: 5, trimEnd: 0, prepend: 0, append: 2, rebuild: false })
    expect(calls).toBeLessThanOrEqual(5)

    const trimPrepend = ['p', ...keys.slice(0, 90)]
    expect(map.diff(91, (i) => trimPrepend[i]!)).toEqual({ trimStart: 0, trimEnd: 10, prepend: 1, append: 0, rebuild: false })

    const middle = [...keys.slice(0, 50), 'm', ...keys.slice(50)]
    expect(map.diff(101, (i) => middle[i]!).rebuild).toBe(true)
  })

  it('reports removed keys, but not keys that come back', () => {
    const keys = ['a', 'b', 'c', 'd']
    const map = load(keys)
    const removed: Key[] = []
    const moved = ['d', 'x', 'a']
    map.apply({ ...NO_CHANGE, rebuild: true }, 3, (i) => moved[i]!, (i) => keys[i]!, (k) => removed.push(k))
    expect(removed.sort()).toEqual(['b', 'c'])
  })
})
