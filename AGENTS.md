# Agent and contributor guide

Instructions for coding agents and humans working in this repository.

## Layout

- `packages/core` - `@anchorlist/core`, framework-agnostic engine. Zero runtime dependencies.
- `packages/react` - `@anchorlist/react`, React bindings (React is a peer dependency).
- `packages/anchorlist` - unscoped `anchorlist`, re-exports core and react. Its README is the npm landing page.
- `fixtures/*` - minimal framework apps used by end-to-end scenarios. Each exposes `window.__driver`.
- `scenarios/` - framework-neutral Playwright scenarios (`scenarios/tests`).
- `bench/` - performance benchmarks (placeholder).
- `docs/` - VitePress documentation site.

## Toolchain

- Node 24 (`.nvmrc`), pnpm (version pinned in root `packageManager`).
- Build: tsdown (ESM only, `.d.ts`, ES2020). Unit tests: Vitest + fast-check. E2E: Playwright
  (Chromium, WebKit, Firefox). Size: size-limit. Releases: Changesets.

## Commands

```sh
pnpm install
pnpm build        # build all packages
pnpm typecheck    # tsc across the workspace
pnpm lint         # eslint (flat config)
pnpm test         # vitest unit tests
pnpm size         # size-limit budgets (run after build)
pnpm e2e          # playwright; first run: pnpm exec playwright install chromium webkit firefox
pnpm docs:build   # build the docs site
```

All of these must pass before a change is considered done.

## Conventions

- **No AI attribution.** Do not add `Co-Authored-By` trailers, "generated with" footers or any mention
  of AI tools in commits, pull requests, code comments or docs.
- **One changeset per PR** that touches a published package: run `pnpm changeset`. All published
  packages are versioned together (`fixed` group). Docs/tooling-only PRs do not need one.
- **Size budgets are hard limits** (`.size-limit.json`, gzip): core list entry 4.5 kB, core all
  6.5 kB, `@anchorlist/react` alone 1.3 kB, React chat path (core + react) 5.8 kB. Do not raise a
  budget without an explicit decision recorded in the PR.
- **Zero dependencies in core.** Framework packages may only depend on `@anchorlist/core` and peers.
- TypeScript is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax` and `isolatedDeclarations`: annotate exported values explicitly and use
  `import type` for types.
- Prefer small pure functions; keep DOM access at the edges.
- Every behaviour change needs a unit test; scroll/anchoring behaviour also needs a scenario in
  `scenarios/` that runs on all three browsers.
- Do not publish, push tags or change release settings; releases run through the `release.yml`
  workflow (npm trusted publishing with provenance).
