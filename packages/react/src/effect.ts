import { useEffect, useLayoutEffect as useLayout } from 'react'

/**
 * `useLayoutEffect` in the browser and `useEffect` without a DOM. Neither runs
 * during server rendering, but React 18 warns about layout effects there.
 */
export const useLayoutEffect: typeof useLayout = typeof document < 'u' ? useLayout : useEffect
