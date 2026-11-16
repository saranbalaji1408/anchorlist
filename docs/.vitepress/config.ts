import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { HeadConfig, PageData, TransformContext, UserConfig } from 'vitepress'
import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

const SITE_ORIGIN = 'https://saranbalaji1408.github.io'
const BASE = '/anchorlist/'
const SITE_URL = `${SITE_ORIGIN}${BASE}`
const REPO_URL = 'https://github.com/saranbalaji1408/anchorlist'
const SITE_NAME = 'anchorlist'
const SITE_TITLE = 'anchorlist, a React virtual list with stable scroll anchoring'
const SITE_DESCRIPTION =
  'anchorlist is a tiny virtual list for React, Vue and Svelte with stable scroll anchoring: chat lists and reverse infinite scroll without scroll jump, infinite feeds and dynamic item heights.'
// TODO(og-image): replace the static placeholder with per-page build-time OG images
// once a lightweight, maintained generator is chosen (e.g. satori + @resvg/resvg-js).
const OG_IMAGE = `${SITE_URL}og.png`

// vitepress-plugin-llms is typed against a newer Vite major than the one VitePress 1.x bundles.
type VitePlugins = NonNullable<NonNullable<UserConfig['vite']>['plugins']>
const llmsPlugins = llmstxt({
  domain: SITE_ORIGIN,
  title: SITE_NAME,
  description: 'A virtual list for React with stable scroll anchoring (chat, reverse infinite scroll, feeds, dynamic heights).',
  details: [
    'anchorlist v0.6 ships `@anchorlist/core` (framework-agnostic engine, zero dependencies),',
    '`@anchorlist/react`, `@anchorlist/vue` and `@anchorlist/svelte`; the unscoped `anchorlist` package re-exports core and React.',
    "Use `align: 'end'` for chat (pinned to the newest item) and `align: 'start'` (default) for feeds.",
    'Pass `scroller={windowScroller}` (`anchorlist/window`) to scroll with the page, `scroller={horizontal()}`',
    '(`anchorlist/horizontal`) for a horizontal list and `horizontal(rtlScroller)` (`anchorlist/rtl`) for right-to-left.',
    'Vue 3: `AnchorList` from `@anchorlist/vue` (rows in the default scoped slot, callbacks as events, handle via template ref);',
    'opt-in `@anchorlist/vue/sticky`, `@anchorlist/vue/horizontal` and `@anchorlist/vue/lanes`.',
    'Svelte 5: `AnchorList` from `@anchorlist/svelte` (rows in a `children` snippet, handle via bind:this with `getElement()`);',
    'opt-in `@anchorlist/svelte/sticky`, `@anchorlist/svelte/horizontal` and `@anchorlist/svelte/lanes`.',
    'Grids and masonry: `<LanesList lanes={grid({ lanes: 4 })} />` or `masonry({ lanes: 3, gap: 8 })` from `anchorlist/lanes`;',
    'create the layout once per list (useState), keep `overscan` at least the largest item, and use a header instead of padding.',
    'Items need unique, stable keys; replace arrays instead of mutating them; never set scrollTop directly.',
    'Keep `renderItem` stable (module scope or useCallback) so a prepend re-renders no mounted row.',
    'Opt-in entries: `anchorlist/sticky` (StickyItem), `anchorlist/animate` (animateToKey), `anchorlist/snapshot`',
    '(takeSnapshot, snapshotEstimate) and `anchorlist/ssr` (initialPlan, with the initialRect option).',
  ].join('\n'),
}) as unknown as VitePlugins

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../packages/anchorlist/package.json', import.meta.url)), 'utf8'),
) as { version: string }

/** Absolute canonical URL for a page, honouring cleanUrls. */
function canonicalFor(relativePath: string): string {
  const path = relativePath
    .replace(/(^|\/)index\.md$/, '$1')
    .replace(/\.md$/, '')
  return `${SITE_URL}${path}`
}

function jsonLd(data: Record<string, unknown>): HeadConfig {
  return ['script', { type: 'application/ld+json' }, JSON.stringify(data)]
}

function structuredData(pageData: PageData, url: string): HeadConfig[] {
  const isHome = pageData.relativePath === 'index.md'
  const entries: HeadConfig[] = [
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      codeRepository: REPO_URL,
      programmingLanguage: 'TypeScript',
      license: 'https://opensource.org/licenses/MIT',
      runtimePlatform: 'browser',
      version: pkg.version,
      keywords:
        'virtual list, virtualized list, react virtual list, chat, reverse infinite scroll, infinite scroll, scroll anchoring, dynamic height, sticky headers, server rendering, window scroller, horizontal virtual list, rtl, virtual grid, masonry, vue virtual list, svelte virtual list',
    }),
  ]

  if (isHome) {
    entries.push(
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        softwareVersion: pkg.version,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }),
    )
  } else {
    // Home > Page. Section index pages do not exist yet, so intermediate crumbs are omitted.
    const items = [
      { name: 'Home', item: SITE_URL },
      { name: pageData.title, item: url },
    ]
    entries.push(
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((entry, i) => ({ '@type': 'ListItem', position: i + 1, ...entry })),
      }),
    )
  }

  return entries
}

export default defineConfig({
  lang: 'en-US',
  title: SITE_NAME,
  titleTemplate: ':title | anchorlist',
  description: SITE_DESCRIPTION,
  base: BASE,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: SITE_URL },

  head: [
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { name: 'robots', content: 'index, follow, max-image-preview:large' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}favicon.svg` }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: SITE_NAME }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  transformPageData(pageData) {
    const fm = pageData.frontmatter
    const isHome = pageData.relativePath === 'index.md'
    const title: string = fm.title ?? pageData.title ?? SITE_TITLE
    const description: string = fm.description ?? pageData.description ?? SITE_DESCRIPTION
    if (isHome) {
      // Home page uses the full brand title without the template suffix.
      pageData.titleTemplate = false
      fm.title = fm.title ?? SITE_TITLE
    }
    pageData.title = isHome ? fm.title : title
    pageData.description = description
  },

  transformHead({ pageData }: TransformContext): HeadConfig[] {
    if (pageData.isNotFound) return [['meta', { name: 'robots', content: 'noindex' }]]
    const url = canonicalFor(pageData.relativePath)
    const title = pageData.relativePath === 'index.md' ? pageData.title : `${pageData.title} | ${SITE_NAME}`
    const description = pageData.description || SITE_DESCRIPTION
    const image: string = pageData.frontmatter.image ?? OG_IMAGE
    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:image', content: image }],
      ['meta', { property: 'og:image:alt', content: title }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: image }],
      ...structuredData(pageData, url),
    ]
  },

  vite: {
    plugins: [llmsPlugins],
  },

  themeConfig: {
    logo: { src: '/favicon.svg', alt: 'anchorlist logo' },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'Compare', link: '/compare/tanstack-virtual' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Chat (pinned to the end)', link: '/guide/chat-virtual-list' },
          { text: 'Feed (pinned to the start)', link: '/guide/feed' },
          { text: 'Dynamic height', link: '/guide/dynamic-height' },
          { text: 'Sticky group headers', link: '/guide/sticky-headers' },
          { text: 'Smooth scroll to an item', link: '/guide/smooth-scroll' },
          { text: 'Accessibility and focus', link: '/guide/accessibility' },
          { text: 'Server rendering', link: '/guide/server-rendering' },
          { text: 'Window scroller', link: '/guide/window-scroller' },
          { text: 'Horizontal list', link: '/guide/horizontal-list' },
          { text: 'Right-to-left (RTL)', link: '/guide/rtl-virtual-list' },
          { text: 'Grid and masonry', link: '/guide/virtual-grid-masonry' },
          { text: 'Vue', link: '/guide/vue' },
          { text: 'Svelte', link: '/guide/svelte' },
        ],
      },
      {
        text: 'Compare',
        items: [
          { text: 'vs TanStack Virtual', link: '/compare/tanstack-virtual' },
          { text: 'vs react-virtuoso', link: '/compare/react-virtuoso' },
          { text: 'Chat benchmark', link: '/compare/benchmark' },
        ],
      },
      { text: 'API', items: [{ text: 'Reference', link: '/api/' }] },
    ],
    socialLinks: [{ icon: 'github', link: REPO_URL }],
    editLink: { pattern: `${REPO_URL}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
    search: { provider: 'local' },
    footer: { message: 'Released under the MIT Licence.' },
  },
})
