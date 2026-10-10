import { describe, expect, it } from 'vitest'
import * as core from '@anchorlist/core'
import * as react from '@anchorlist/react'
import * as coreAnimate from '@anchorlist/core/animate'
import * as coreSnapshot from '@anchorlist/core/snapshot'
import * as coreSticky from '@anchorlist/core/sticky'
import * as reactSticky from '@anchorlist/react/sticky'
import * as animate from './animate'
import * as all from './index'
import * as snapshot from './snapshot'
import * as sticky from './sticky'

describe('anchorlist re-exports', () => {
  it('re-exports every export of @anchorlist/core and @anchorlist/react', () => {
    for (const [name, value] of Object.entries({ ...core, ...react })) {
      expect((all as Record<string, unknown>)[name], name).toBe(value)
    }
  })

  it('exposes the React entry points', () => {
    expect(typeof all.AnchorList).toBe('object') // forwardRef component
    expect(typeof all.useAnchorList).toBe('function')
    expect(typeof all.createVirtualizer).toBe('function')
  })

  it('re-exports the sticky entries of @anchorlist/core and @anchorlist/react from anchorlist/sticky', () => {
    for (const [name, value] of Object.entries({ ...coreSticky, ...reactSticky })) {
      expect((sticky as Record<string, unknown>)[name], name).toBe(value)
    }
    expect(typeof sticky.StickyItem).toBe('function')
    expect(typeof sticky.stickyState).toBe('function')
  })

  it('re-exports @anchorlist/core/animate and @anchorlist/core/snapshot', () => {
    expect(animate).toEqual(coreAnimate)
    expect(snapshot).toEqual(coreSnapshot)
    expect(typeof animate.animateToKey).toBe('function')
    expect(typeof snapshot.takeSnapshot).toBe('function')
    expect(typeof snapshot.snapshotEstimate).toBe('function')
  })
})
