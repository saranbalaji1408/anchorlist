---
'@anchorlist/core': minor
---

Add the virtualizer engine. `createVirtualizer(options, host)` windows a list and anchors scrolling to item keys, with DOM-measured restoration before paint. It supports lists pinned to either edge (`align: 'start' | 'end'`) and follows new items at the pinned edge, including trim+append. When the anchor item is removed, two-sided fallbacks take over. `scrollToKey` stays locked on its target while sizes settle. Corrections are deferred into a transform on touch WebKit and during rubber-band overscroll. The release also adds the `elementScroller` and `simulatedScroller` adapters and the `SizeIndex`, `KeyMap` and `SizeCache` data structures.
