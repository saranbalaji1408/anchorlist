import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createSizeCache } from './sizeCache'

describe('SizeCache', () => {
  it('stores, averages and deletes', () => {
    const cache = createSizeCache()
    expect(cache.average()).toBeUndefined()
    cache.set('a', 100)
    cache.set('b', 50)
    expect(cache.average()).toBe(75)
    cache.set('a', 200)
    expect(cache.average()).toBe(125)
    cache.delete('a')
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(50)
    expect(cache.average()).toBe(50)
  })

  it('marks entries stale on a cross-axis change and freshens them on set', () => {
    const cache = createSizeCache()
    cache.set('a', 10)
    cache.set('b', 20)
    cache.markStale()
    expect(cache.get('a')).toBe(10)
    expect(cache.isFresh('a')).toBe(false)
    cache.set('a', 12)
    expect(cache.isFresh('a')).toBe(true)
    expect(cache.isFresh('b')).toBe(false)
    expect(cache.isFresh('missing')).toBe(false)
  })

  it('evicts the least recently measured entry beyond max', () => {
    const cache = createSizeCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 1)
    cache.set('c', 3)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('c')).toBe(3)
  })

  it('keeps the average consistent with the stored entries (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom('set', 'delete'), fc.nat(20), fc.integer({ min: 0, max: 500 })), { maxLength: 80 }),
        fc.integer({ min: 1, max: 30 }),
        (ops, max) => {
          const cache = createSizeCache(max)
          const ref = new Map<string, number>()
          for (const [op, k, v] of ops) {
            const key = `k${k}`
            if (op === 'set') {
              cache.set(key, v)
              ref.delete(key)
              ref.set(key, v)
              if (ref.size > max) ref.delete(ref.keys().next().value as string)
            } else {
              cache.delete(key)
              ref.delete(key)
            }
          }
          for (let k = 0; k <= 20; k++) expect(cache.get(`k${k}`)).toBe(ref.get(`k${k}`))
          const values = [...ref.values()]
          const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined
          if (avg === undefined) expect(cache.average()).toBeUndefined()
          else expect(cache.average()).toBeCloseTo(avg, 6)
        },
      ),
    )
  })
})
