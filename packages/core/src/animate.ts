import type { Axis } from './scroller'
import type { Key } from './types'
import type { ScrollToOptions, Virtualizer } from './virtualizer'

/** Options of {@link animateToKey}. */
export interface AnimateOptions extends ScrollToOptions {
  /** Duration in ms. Default 400. */
  duration?: number
  /** Maps time (0 to 1) to progress (0 to 1). Default: ease in-out cubic. */
  easing?: (t: number) => number
  /** Axis properties of the scroll container. Default: vertical. */
  axis?: Pick<Axis, 'offset' | 'client' | 'scrollSize'>
  /** Aborting cancels the animation (the promise resolves `false`). */
  signal?: AbortSignal
}

const ALIGN = { start: 0, center: 0.5, end: 1 }
const VERTICAL: Pick<Axis, 'offset' | 'client' | 'scrollSize'> = { offset: 'scrollTop', client: 'clientHeight', scrollSize: 'scrollHeight' }
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (2 - 2 * t) ** 3 / 2)
/** Running animation per scroll container, so a new one replaces it. */
const running = new WeakMap<object, () => void>()

/**
 * Smoothly scrolls `element` (the list's scroll container) to the item with
 * `key`, including items that are not mounted. The target is recomputed from
 * the engine's layout on every frame, so rows measured on the way (which move
 * the target) are absorbed; the last frame hands over to
 * `v.scrollToKey(key, options)`, which lands exactly and locks while sizes settle.
 *
 * Each frame scrolls like a user would, so the engine keeps the content
 * anchored while rows mount. User input on the container (`wheel`,
 * `touchstart`, `pointerdown`, `keydown`), `signal`, or a new animation on
 * the same container cancels it. With `prefers-reduced-motion: reduce` it
 * jumps at once.
 *
 * @returns Resolves `true` once landed, `false` if the key is unknown or the
 *   animation was cancelled.
 */
export function animateToKey(
  v: Pick<Virtualizer, 'getItemRect' | 'scrollToKey'>,
  element: HTMLElement,
  key: Key,
  options: AnimateOptions = {},
): Promise<boolean> {
  const { align = 'start', offset = 0, duration = 400, easing = easeInOut, axis = VERTICAL, signal } = options
  const land = (): boolean => v.scrollToKey(key, { align, offset })
  running.get(element)?.()
  return new Promise((resolve) => {
    if (!v.getItemRect(key) || signal?.aborted) return resolve(false)
    if (duration <= 0 || (typeof matchMedia == 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches))
      return resolve(land())
    const types = ['wheel', 'touchstart', 'pointerdown', 'keydown']
    const start = performance.now()
    /** Eased progress at the previous frame. */
    let done = 0
    let id = 0
    const finish = (landed: boolean): void => {
      cancelAnimationFrame(id)
      types.forEach((t) => element.removeEventListener(t, stop))
      signal?.removeEventListener('abort', stop)
      if (running.get(element) === stop) running.delete(element)
      resolve(landed)
    }
    const stop = (): void => finish(false)
    const frame = (now: number): void => {
      const r = v.getItemRect(key)
      const t = Math.min(1, (now - start) / duration)
      if (!r || t >= 1) return finish(!!r && land())
      const viewport = element[axis.client]
      const target = Math.min(Math.max(r.start + offset + (r.size - viewport) * ALIGN[align], 0), element[axis.scrollSize] - viewport)
      const e = easing(t)
      // Cover the eased share of what remains, so a moving target is still met at t = 1.
      const from = element[axis.offset]
      element[axis.offset] = from + ((target - from) * (e - done)) / (1 - done || 1)
      done = e
      id = requestAnimationFrame(frame)
    }
    types.forEach((t) => element.addEventListener(t, stop, { passive: true }))
    signal?.addEventListener('abort', stop)
    running.set(element, stop)
    id = requestAnimationFrame(frame)
  })
}
