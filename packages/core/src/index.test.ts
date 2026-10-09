import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { VERSION } from './index'

describe('VERSION', () => {
  it('is a semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('property harness is wired up', () => {
    fc.assert(fc.property(fc.integer(), (n) => n + 0 === n))
  })
})
