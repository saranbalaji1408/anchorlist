---
layout: home
title: anchorlist, a React virtual list with stable scroll anchoring
description: anchorlist is a tiny virtual list for React with stable scroll anchoring. Build chat lists and reverse infinite scroll without scroll jump, infinite feeds and lists with dynamic item heights.

hero:
  name: anchorlist
  text: A virtual list that keeps its place
  tagline: React chat lists and reverse infinite scroll without scroll jump, infinite feeds and dynamic heights. A zero-dependency core with a 4.5 kB gzip budget.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: React chat virtual list
      link: /guide/chat-virtual-list
    - theme: alt
      text: GitHub
      link: https://github.com/saranbalaji1408/anchorlist

features:
  - title: Pin to the end or the start
    details: "align: 'end' for chat (opens at the newest message and follows new ones), 'start' for feeds. Both use one code path."
    link: /guide/chat-virtual-list
  - title: Prepend without scroll jump
    details: Load older messages or insert new posts above the reader. The viewport is anchored to an item key, so what you are reading stays put.
    link: /guide/feed
  - title: Dynamic heights, no estimate
    details: Rows are measured in the DOM as they render. Images loading, text re-wrapping and width changes are corrected before paint.
    link: /guide/dynamic-height
  - title: Small and tested
    details: Hard gzip size budgets in CI, zero runtime dependencies in core, a 1.2M-operation fuzz test and scenarios in Chromium, WebKit and Firefox.
    link: /api/
---

## Install

```sh
npm install anchorlist
```

## Guides

- [Getting started](/guide/getting-started): install, a minimal chat and a minimal feed.
- [React chat virtual list](/guide/chat-virtual-list): bottom-anchored, follow, prepend history,
  keyboard resizes.
- [Infinite scroll feed](/guide/feed): top-anchored, load more, restore the position.
- [Virtualized list with dynamic height](/guide/dynamic-height): measured rows and width changes.
- [API reference](/api/)
- Comparisons: [TanStack Virtual alternative](/compare/tanstack-virtual),
  [react-virtuoso alternative](/compare/react-virtuoso)

v0.1 ships React bindings and the framework-agnostic core. Vue and Svelte bindings are planned.
