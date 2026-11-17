import { createApp } from 'vue'
import '../../react/src/style.css'
import { installDriver } from './driver'
import ChatExample from './examples/ChatExample.vue'
import FeedExample from './examples/FeedExample.vue'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// `?example=chat` and `?example=feed` render the README examples; otherwise
// the page waits for scenarios to mount lists through `window.__driver`.
const example = new URLSearchParams(location.search).get('example')
if (example) {
  createApp(example === 'feed' ? FeedExample : ChatExample).mount(container)
} else {
  installDriver(container)
}
