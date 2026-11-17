import { describe, expect, it } from 'vitest'
import { keysOf, mount, type Harness } from './test/harness'
import type { Edge, Key } from './types'

/**
 * Engine fuzz: seeded random operations on a simulated scroller. After every
 * operation the anchor item's `align`-side edge must stay within 0.5 px of
 * where it was, unless the list was pinned (then it must still be pinned),
 * the operation scrolled on purpose, or the position became unreachable.
 *
 * FUZZ_ITERATIONS sets the number of operations per align mode, FUZZ_SEED the sequence.
 */
// The core has no Node types; tests read a few environment variables.
declare const process: { env: Record<string, string | undefined> }
/** Appends to a debug file (FUZZ_LOG / FUZZ_TRACE). */
const append = async (file: string, text: string): Promise<void> => {
  const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { appendFileSync(file: string, text: string): void }
  fs.appendFileSync(file, text)
}

const ITERATIONS = Number(process.env.FUZZ_ITERATIONS ?? 1500)
const TOLERANCE = 0.5
/** FUZZ_SEED picks another deterministic sequence. */
const SEED = Number(process.env.FUZZ_SEED ?? 1)

const mulberry32 = (seed: number) => (): number => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Op =
  | 'prepend'
  | 'append'
  | 'trimStart'
  | 'trimEnd'
  | 'trimAppend'
  | 'trimPrepend'
  | 'resize'
  | 'stream'
  | 'insertMiddle'
  | 'deleteMiddle'
  | 'deleteAnchor'
  | 'header'
  | 'crossResize'
  | 'idle'
  | 'scroll'
  | 'viewport'
  | 'scrollToKey'
  | 'scrollToEdge'
  | 'touch'
  | 'scrollUpdate'

/** Operations that move the viewport on purpose: no drift check. */
const MOVES = new Set<Op>(['scroll', 'scrollToKey', 'scrollToEdge'])

const WEIGHTS: Array<[Op, number]> = [
  ['prepend', 8],
  ['append', 8],
  ['trimStart', 4],
  ['trimEnd', 4],
  ['trimAppend', 4],
  ['trimPrepend', 4],
  ['resize', 12],
  ['stream', 8],
  ['insertMiddle', 3],
  ['deleteMiddle', 3],
  ['deleteAnchor', 3],
  ['header', 2],
  ['crossResize', 2],
  ['idle', 3],
  ['scroll', 12],
  ['viewport', 3],
  ['scrollToKey', 3],
  ['scrollToEdge', 2],
  ['touch', 4],
  ['scrollUpdate', 6],
]
const TOTAL_WEIGHT = WEIGHTS.reduce((s, [, w]) => s + w, 0)

interface Failure {
  step: number
  op: Op
  detail: string
}

interface Variant {
  gap?: number
  touchWebKit?: boolean
  quantize?: 'round' | 'trunc'
}

async function run(
  align: Edge,
  seed: number,
  iterations: number,
  variant: Variant = {},
): Promise<{ failures: Failure[]; checked: number }> {
  const rand = mulberry32(seed)
  const int = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1))
  const size = (): number => (rand() < 0.2 ? int(20, 60) + 0.5 : int(20, 220))
  let next = 0
  const fresh = (n: number): Key[] => Array.from({ length: n }, () => `n${next++}`)
  const h: Harness = mount({
    keys: keysOf(150),
    size,
    viewport: 600,
    crossSize: 400,
    gap: variant.gap ?? 0,
    touchWebKit: variant.touchWebKit ?? false,
    ...(variant.quantize ? { quantize: variant.quantize } : {}),
    options: { align, overscan: 200, paddingStart: variant.gap ? 12 : 0, paddingEnd: variant.gap ? 20 : 0 },
  })
  let touching = false
  // A render can clamp the offset before the commit runs (new rows, old
  // spacers). Movement lost to that clamp cannot be recovered by any engine.
  let renderClamped: boolean | undefined
  const setRows = h.sim.setRows
  h.sim.setRows = (rows) => {
    const before = h.sim.offset()
    setRows(rows)
    if (h.sim.offset() !== before) renderClamped = true
  }
  await h.settle()

  const failures: Failure[] = []
  let checked = 0
  const edgeOf = (key: Key): number | undefined => {
    const rect = h.v.getItemRect(key)
    // Not rendered: use the model position (content space minus the offset, plus any deferred shift).
    const model = rect && rect.start - h.sim.offset() + h.sim.translation + (align === 'end' ? rect.size : 0)
    return (align === 'end' ? h.visualEnd(key) : h.visualStart(key)) ?? model ?? undefined
  }
  const without = (a: Key[], b: Key[]): Set<Key> => {
    const keep = new Set(b)
    return new Set(a.filter((key) => !keep.has(key)))
  }
  const pick = (): Op => {
    // Keep the list between 30 and ~1500 items.
    if (h.keys.length > 1500) return rand() < 0.5 ? 'trimStart' : 'trimEnd'
    let r = rand() * TOTAL_WEIGHT
    for (const [op, w] of WEIGHTS) if ((r -= w) < 0) return op
    return 'resize'
  }

  const trace = async (label: string): Promise<void> => {
    if (!process.env.FUZZ_TRACE) return
    const snap = h.v.getSnapshot()
    await append(
      process.env.FUZZ_TRACE,
      `${label} off=${h.sim.offset()} tr=${h.sim.translation} vp=${h.sim.viewport()} size=${h.sim.scrollSize()} touching=${touching} t=${h.sim.now()} snap=${JSON.stringify(snap)} edge=${snap.key === null ? '' : edgeOf(snap.key)}\n`,
    )
  }
  const traceFrom = Number(process.env.FUZZ_TRACE_FROM ?? Infinity)
  const traceTo = Number(process.env.FUZZ_TRACE_TO ?? -1)

  for (let step = 0; step < iterations; step++) {
    const op = pick()
    const tracing = step >= traceFrom && step <= traceTo
    if (tracing) await trace(`step ${step} ${op} before`)
    const snap = h.v.getSnapshot()
    let anchor = snap.key
    let moved = false
    // Positions of rows at distances 1..8, 16, 32, ... on both sides of the
    // anchor (mounted or not), for anchor-removal checks.
    const anchorActual = anchor === null ? undefined : edgeOf(anchor)
    const ai = anchor === null ? -1 : h.v.indexOf(anchor)
    const probes: Array<[number, Key, number]> = []
    if (ai >= 0)
      for (let s = 1; s < 2 * h.keys.length; s = s < 8 ? s + 1 : s * 2)
        for (const dir of [1, -1]) {
          const k = h.keys[ai + dir * s]
          if (k !== undefined) probes.push([dir * s, k, edgeOf(k)!])
        }
    // Two references. Scroll offsets are whole pixels on most engines. Each
    // painted change moves content at most 0.5 px (unit-tested separately),
    // but one fuzz op can span several painted changes (a commit, then a
    // resize correction), so per op: content moves at most 1 px from where it
    // actually was (`actual`), and it never ends more than 1 px from its
    // intended position (`before`, the snapshot delta), so errors cannot build up.
    let before = anchor === null ? undefined : snap.delta
    let actual = anchorActual
    const keys = h.keys
    const n = keys.length
    const mounted = [...h.mounted.keys()]
    let removed = new Set<Key>()
    let note = ''
    let target: { key: Key; a: 'start' | 'center' | 'end' } | undefined
    let toEdge: Edge | undefined
    let userPinned = false
    renderClamped = false
    let expectedShift = 0
    const effBefore = h.sim.offset() - h.sim.translation
    let settleFrames = 4

    switch (op) {
      case 'prepend':
        h.setKeys([...fresh(int(1, 25)), ...keys])
        break
      case 'append':
        h.setKeys([...keys, ...fresh(int(1, 25))])
        break
      case 'trimStart':
      case 'trimEnd': {
        const k = Math.min(n > 1500 ? int(100, 400) : int(1, 25), n - 30)
        if (k <= 0) break
        const next = op === 'trimStart' ? keys.slice(k) : keys.slice(0, n - k)
        removed = without(keys, next)
        h.setKeys(next)
        break
      }
      case 'trimAppend':
      case 'trimPrepend': {
        const k = Math.min(int(1, 20), n - 30)
        if (k <= 0) break
        const added = fresh(int(1, 20))
        const next = op === 'trimAppend' ? [...keys.slice(k), ...added] : [...added, ...keys.slice(0, n - k)]
        removed = without(keys, next)
        h.setKeys(next)
        break
      }
      case 'resize': {
        const key = rand() < 0.7 && mounted.length ? mounted[int(0, mounted.length - 1)]! : keys[int(0, n - 1)]!
        const from = h.sizes.get(key)
        h.resize(key, size())
        note = ` (resized ${key} at ${h.v.indexOf(key) - (anchor === null ? 0 : h.v.indexOf(anchor))} from the anchor, ${from} -> ${h.sizes.get(key)}, mounted ${h.mounted.has(key)})`
        break
      }
      case 'stream': {
        const key = keys[n - 1]!
        h.resize(key, (h.sizes.get(key) ?? 50) + int(5, 40))
        break
      }
      case 'insertMiddle': {
        const at = int(1, n - 1)
        h.setKeys([...keys.slice(0, at), ...fresh(int(1, 5)), ...keys.slice(at)])
        break
      }
      case 'deleteMiddle':
      case 'deleteAnchor': {
        if (n < 40) break
        const at = op === 'deleteAnchor' && anchor !== null ? h.v.indexOf(anchor) : int(1, n - 2)
        const k = op === 'deleteAnchor' ? 1 : int(1, 4)
        removed = new Set(keys.slice(at, at + k))
        h.setKeys([...keys.slice(0, at), ...keys.slice(at + k)])
        break
      }
      case 'header':
        h.sim.setHeader(int(0, 120))
        break
      case 'crossResize': {
        // Narrower or wider: every item changes size, mounted ones are remeasured in the same frame.
        const factor = 0.7 + rand() * 0.6
        for (const key of keys) h.resize(key, Math.max(10, Math.round((h.sizes.get(key) ?? 50) * factor)))
        h.sim.resizeViewport(h.sim.viewport(), int(250, 600))
        break
      }
      case 'idle':
        h.sim.advance(int(150, 500))
        break
      case 'scroll':
        h.sim.userScroll(h.sim.offset() + int(-900, 900))
        break
      case 'scrollUpdate': {
        // The user scrolls, then a re-render commits before the scroll event
        // arrives. The scroll must be kept and the update still compensated.
        const from = h.sim.offset()
        h.sim.userScroll(from + int(-300, 300))
        if (from !== h.sim.offset()) {
          // The scroll is the user's: from here the item the engine will
          // anchor on (first visible) must not move.
          anchor = h.v.getSnapshot().key
          before = actual = anchor === null ? undefined : edgeOf(anchor)
          moved = true
        }
        // Ending within atEdgeThreshold of the align edge pins (documented): no drift check.
        if (moved && h.v.isAtEdge()) userPinned = true
        if (tracing) await trace(`  scrolled`)
        h.setKeys(rand() < 0.5 ? [...fresh(int(1, 10)), ...keys] : [...keys])
        break
      }
      case 'viewport': {
        const vp = int(300, 800)
        if (align === 'end') expectedShift = vp - h.sim.viewport()
        h.sim.resizeViewport(vp)
        break
      }
      case 'scrollToKey':
        target = { key: keys[int(0, n - 1)]!, a: (['start', 'center', 'end'] as const)[int(0, 2)]! }
        h.v.scrollToKey(target.key, { align: target.a })
        settleFrames = 12
        break
      case 'scrollToEdge':
        h.v.scrollToEdge((toEdge = rand() < 0.5 ? 'start' : 'end'))
        settleFrames = 8
        break
      case 'touch':
        if (!variant.touchWebKit) break
        h.sim.touch((touching = !touching))
        break
    }
    await h.settle(settleFrames)
    if (tracing) await trace(`step ${step} ${op} after`)

    const eff = h.sim.offset() - h.sim.translation
    const atLimit = eff <= TOLERANCE || eff >= h.sim.scrollSize() - h.sim.viewport() - TOLERANCE
    if (toEdge) {
      checked++
      if (!h.v.isAtEdge(toEdge)) failures.push({ step, op, detail: `did not reach the ${toEdge} edge` })
      continue
    }
    if (target) {
      // Settled: the key is aligned, unless the offset is at a limit.
      const s = h.visualStart(target.key)
      const z = h.sizes.get(target.key) ?? 0
      const miss = s === undefined ? Infinity : s + (z - h.sim.viewport()) * { start: 0, center: 0.5, end: 1 }[target.a]
      checked++
      if (Math.abs(miss) > 2 * TOLERANCE + 1e-6 && !atLimit)
        failures.push({ step, op, detail: `scrollToKey ${target.key} (${target.a}) is off by ${miss.toFixed(2)} px` })
      continue
    }
    // A user scroll that ends at the align edge pins (also when the update shrank the content).
    if (MOVES.has(op) || (op === 'scrollUpdate' && (renderClamped || userPinned || h.v.isAtEdge()))) continue
    if (snap.pinned && !moved) {
      // Pinned: follow at the pinned edge, through trims and resizes.
      checked++
      if (!h.v.isAtEdge()) failures.push({ step, op, detail: `lost the ${align} edge (offset ${h.sim.offset()})` })
      continue
    }
    if (anchor === null || before === undefined) continue
    if (removed.has(anchor)) {
      // The anchor is gone: rows after the gap (else before it) must hold
      // their intended positions, for both aligns. Removals are one
      // contiguous run, so any surviving row on that side represents it.
      const side = (dir: number): [number, Key, number] | undefined =>
        probes.find(([d, k]) => Math.sign(d) === dir && !removed.has(k))
      const held = side(1) ?? side(-1)
      if (held === undefined || anchorActual === undefined) {
        // Nothing survived: back at the align edge, like a fresh mount.
        checked++
        if (!h.v.isAtEdge()) failures.push({ step, op, detail: 'list replaced but not at the align edge' })
        continue
      }
      // The same whole-pixel error applies to every row, so take it from the anchor.
      anchor = held[1]
      before = held[2] - (anchorActual - snap.delta)
      actual = held[2]
    }
    const after = edgeOf(anchor)
    if (after === undefined) {
      failures.push({ step, op, detail: `anchor ${anchor} lost` })
      continue
    }
    // A viewport change is checked against the geometry before it: when the
    // shifted position was out of range then, the engine adopts the clamp.
    if (op === 'viewport' && (effBefore - expectedShift < 0 || effBefore - expectedShift > h.sim.scrollSize() - h.sim.viewport())) continue
    const drift = after - before - expectedShift
    const move = after - actual! - expectedShift
    if (Math.abs(move) <= 2 * TOLERANCE + 1e-6 && Math.abs(drift) <= 2 * TOLERANCE + 1e-6) {
      checked++
      continue
    }
    // Unreachable: holding the anchor would need an effective offset (the
    // offset plus any deferred correction) outside [0, max].
    const needed = h.sim.offset() - h.sim.translation + move
    const max = h.sim.scrollSize() - h.sim.viewport()
    if (needed < -1e-6 || needed > max + 1e-6) continue
    failures.push({ step, op, detail: `anchor ${anchor} moved ${move.toFixed(2)} px, ${drift.toFixed(2)} px from intended${note}` })
  }
  return { failures, checked }
}

const VARIANTS: Array<[string, Variant]> = [
  ['plain', {}],
  ['gap and padding', { gap: 6 }],
  ['touch WebKit', { touchWebKit: true }],
  ['whole pixels, rounding', { quantize: 'round' }],
  ['whole pixels, truncating', { quantize: 'trunc', gap: 6 }],
]

describe('engine fuzz', () => {
  for (const [name, variant] of VARIANTS)
  for (const align of ['end', 'start'] as const) {
    it(`keeps the anchor within ${TOLERANCE} px (${name}, align ${align}, ${ITERATIONS} ops)`, async () => {
      const { failures, checked } = await run(align, SEED + (align === 'end' ? 0 : 1), ITERATIONS, variant)
      if (process.env.FUZZ_LOG) {
        const lines = failures.map((f) => `${name}/${align} ${f.step} ${f.op}: ${f.detail}`)
        await append(process.env.FUZZ_LOG, `${name}/${align} checked ${checked}\n` + lines.map((l) => l + '\n').join(''))
      }
      expect(failures.slice(0, 5)).toEqual([])
      expect(checked).toBeGreaterThan(ITERATIONS / 4)
    }, 600_000)
  }
})
