# Architecture

SHTD is a TypeScript monorepo: one healing engine (`@shtd/core`), three surfaces
(CLI, GitHub Action, Next.js dashboard), plus shared types and Postgres schema.

## Pipeline

```
Triggers (CLI | GitHub Action | schedule | feedback)
        ↓
   Ingest (MD/MDX, OpenAPI, TS symbols) → Doc Graph
        ↓
   Detect in parallel
     • Code–doc drift
     • Broken links / anchors / images
     • OpenAPI mismatches
     • Validate-tagged examples
     • Reader feedback → findings
        ↓
   Heal (docs-only patches) → confidence score
        ↓
   Apply: PR and/or dashboard persistence
```

## Packages

| Package | Role |
|---|---|
| `@shtd/core` | Ingest, detectors, patch generator, scorer, GitHub client helpers |
| `@shtd/cli` | `shtd scan` / `shtd heal` / `shtd feedback add` |
| `@shtd/action` | Composite Action wrapping the built CLI (report artifact, optional heal PR + PR comment) |
| `@shtd/web` | Next.js App Router dashboard + API routes |
| `@shtd/db` | Drizzle schema / migrations |
| `@shtd/shared` | Zod schemas (`HealFinding`, `ShtdConfig`, finding kinds, run triggers) |

## Finding kinds

From `@shtd/shared`:

`drift` · `broken_link` · `broken_anchor` · `orphan_page` · `broken_image` · `openapi_mismatch` · `example_failure` · `feedback`

## Confidence & auto-merge

- Mechanical fixes (links, images, renames) tend to score **high**.
- LLM rewrites and example failures tend to **medium** / **low**.
- Auto-merge only when `shtd.config.json` has `autoMerge.enabled`, every patched finding meets `minConfidence` (default `high`), and CI is green when `requireGreenCi` is set (`SHTD_CI_STATUS=success` for local/stub).

Patches are constrained to `healPaths` (default `docs/**`, `**/*.md`, `**/*.mdx`) — application source is never modified in v1. Mechanical renames use whole-word replacements; LLM patches (Anthropic) are skipped when no API key is set (`MockProvider`).

Invalid `shtd.config.json` fails fast with per-field validation errors (Zod).

## Dogfooding

This repository’s product docs live under [`docs/`](./README.md). CI runs the composite action via:

- [`.github/workflows/shtd.yml`](../.github/workflows/shtd.yml) — dogfood scan/heal on this monorepo
- [`.github/workflows/shtd-sample.yml`](../.github/workflows/shtd-sample.yml) — scan `examples/sample-repo`

Local fixture regression: `pnpm test:e2e` (see [getting-started](./getting-started.md#e2e-fixture-check)).
