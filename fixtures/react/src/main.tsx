import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installDriver } from './driver'
import { ChatExample } from './examples/Chat'
import { FeedExample } from './examples/Feed'
import './style.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// `?example=chat` and `?example=feed` render the README examples; otherwise
// the page waits for scenarios to mount lists through `window.__driver`.
const example = new URLSearchParams(location.search).get('example')
if (example) {
  createRoot(container).render(<StrictMode>{example === 'feed' ? <FeedExample /> : <ChatExample />}</StrictMode>)
} else {
  installDriver(container)
}
