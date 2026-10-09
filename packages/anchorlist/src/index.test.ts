import { describe, expect, it } from 'vitest'
import { REACT_VERSION, VERSION } from './index'

describe('anchorlist re-exports', () => {
  it('re-exports core and react versions', () => {
    expect(VERSION).toBe(REACT_VERSION)
  })
})
