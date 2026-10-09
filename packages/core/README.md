# @anchorlist/core

A framework-agnostic virtual list engine with stable scroll anchoring. It has zero dependencies and
is about 4.5 kB gzip.

- **Pin to either edge:** use `align: 'end'` for chat (newest at the bottom) or `'start'` for feeds.
- **Key-anchored and DOM-measured:** prepends, trims, resizes and anchor removal never move what the
  user is reading.
- **Follows new items at the pinned edge**, including trim+append.
- **Safe on iOS and Safari:** corrections are held in a transform during touch momentum and rubber-band
  bounce.
- **`scrollToKey` stays locked** on its target while sizes settle.
- **Pure `plan()` for concurrent renderers;** O(1) streaming updates and O(k) edge changes.

Most apps should use a framework package such as `@anchorlist/react`. Use the core directly to write
an adapter:

```ts
import { createVirtualizer, elementScroller } from '@anchorlist/core'

const v = createVirtualizer(options, { render: (sync) => rerender(sync) })

// render:         const plan = v.plan(options); render rows plan.start..plan.end keyed by getKey(i)
// before paint:   if (first) v.attach(elementScroller({ element, list, content })); v.commit(plan)
// row ref:        (el) => v.measureElement(el, key)
// unmount:        v.destroy()
```

See [API.md](./API.md) for the adapter contract and the full API, and [DESIGN.md](./DESIGN.md) for
how it works.
