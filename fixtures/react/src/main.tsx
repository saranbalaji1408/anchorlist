import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

declare global {
  interface Window {
    /** Scenario driver bridge. Populated once the Driver interface lands. */
    __driver: Record<string, unknown>
  }
}

window.__driver = {}

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
