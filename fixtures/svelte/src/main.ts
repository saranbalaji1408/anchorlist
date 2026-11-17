import { mount } from 'svelte'
import '../../react/src/style.css'
import { installDriver } from './driver.svelte'
import ChatExample from './examples/ChatExample.svelte'
import FeedExample from './examples/FeedExample.svelte'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// `?example=chat` and `?example=feed` render the README examples; otherwise
// the page waits for scenarios to mount lists through `window.__driver`.
const example = new URLSearchParams(location.search).get('example')
if (example) {
  mount(example === 'feed' ? FeedExample : ChatExample, { target: container })
} else {
  installDriver(container)
}
