// Size budgets (gzip), checked by `pnpm size`. They are hard limits: see AGENTS.md.
//
// An entry that `ignore`s a relative chunk (`./scroller.js`) keeps that import
// in the measured bundle. @size-limit/rolldown builds in a temporary directory,
// so by default the import is written as a path from there to the checkout,
// and its length (measured with the code) depends on where the repository is.
// `chunkPaths` writes it as `./name.js` instead, the same in every checkout.

const chunkPaths = (config) => ({
  ...config,
  output: { ...config.output, paths: (id) => id.replace(/^.*\/dist\//, './') },
})

export default [
  {
    name: '@anchorlist/core (list entry)',
    path: 'packages/core/dist/index.js',
    import: '{ createVirtualizer, elementScroller }',
    limit: '4.5 kB',
    gzip: true,
  },
  {
    name: '@anchorlist/core (all)',
    path: 'packages/core/dist/index.js',
    import: '*',
    limit: '6.5 kB',
    gzip: true,
  },
  {
    name: '@anchorlist/react (react and core external)',
    path: 'packages/react/dist/index.js',
    import: '*',
    ignore: ['react', 'react-dom', '@anchorlist/core'],
    limit: '1.3 kB',
    gzip: true,
  },
  {
    name: 'React chat path (core + react)',
    path: 'packages/react/dist/index.js',
    import: '*',
    ignore: ['react', 'react-dom'],
    limit: '5.8 kB',
    gzip: true,
  },
  {
    name: '@anchorlist/core/sticky',
    path: 'packages/core/dist/sticky.js',
    import: '*',
    limit: '0.5 kB',
    gzip: true,
  },
  {
    name: '@anchorlist/react/sticky (core included)',
    path: 'packages/react/dist/sticky.js',
    import: '*',
    ignore: ['react', 'react-dom'],
    limit: '0.8 kB',
    gzip: true,
  },
  {
    name: '@anchorlist/core/animate',
    path: 'packages/core/dist/animate.js',
    import: '*',
    limit: '0.8 kB',
    gzip: true,
  },
  {
    name: '@anchorlist/core/snapshot',
    path: 'packages/core/dist/snapshot.js',
    import: '*',
    limit: '0.5 kB',
    gzip: true,
  },
  {
    name: '@anchorlist/core/ssr',
    path: 'packages/core/dist/ssr.js',
    import: '*',
    limit: '0.4 kB',
    gzip: true,
  },
  {
    name: '@anchorlist/core/window (shared scroller chunk external)',
    path: 'packages/core/dist/window.js',
    import: '{ windowScroller }',
    ignore: ['./scroller.js'],
    limit: '0.6 kB',
    gzip: true,
    modifyRolldownConfig: chunkPaths,
  },
  {
    name: '@anchorlist/core/rtl (shared scroller chunk external)',
    path: 'packages/core/dist/rtl.js',
    import: '{ rtlScroller }',
    ignore: ['./scroller.js'],
    limit: '0.6 kB',
    gzip: true,
    modifyRolldownConfig: chunkPaths,
  },
  {
    name: '@anchorlist/react/horizontal (react and core external)',
    path: 'packages/react/dist/horizontal.js',
    import: '{ horizontal }',
    ignore: ['react', 'react-dom', '@anchorlist/core'],
    limit: '0.3 kB',
    gzip: true,
  },
]
