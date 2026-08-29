# Self-Healing Technical Documentation

Keep technical docs truthful to the codebase. On every relevant change (or on a schedule),
**detect** stale/broken docs, **propose** patches, and **heal** via PR or auto-merge — with a
dashboard for review, history, and reader feedback.

## Surfaces

| Surface | Package | Role |
|---|---|---|
| CLI | `@shtd/cli` | `shtd scan` / `shtd heal` locally |
| GitHub Action | `@shtd/action` | CI-triggered heal PRs |
| Dashboard | `@shtd/web` | Runs, findings, review queue |
| Engine | `@shtd/core` | Ingest, detect, heal, score |

## Quickstart

```bash
pnpm install
pnpm --filter @shtd/cli... build

# Scan the planted fixture (see examples/sample-repo/FIXTURES.md)
node packages/cli/dist/index.js scan examples/sample-repo

# Dashboard (demo mode without DATABASE_URL / OAuth)
pnpm --filter @shtd/web dev
# → http://localhost:3000

# Fixture regression (build + assert finding kinds/counts)
pnpm test:e2e
```

**GitHub Action:** composite action at [`packages/action`](packages/action). This repo already wires:

- [`.github/workflows/shtd.yml`](.github/workflows/shtd.yml) — dogfood scan/heal
- [`.github/workflows/shtd-sample.yml`](.github/workflows/shtd-sample.yml) — scan `examples/sample-repo`

See [docs/action.md](docs/action.md) and [`packages/action/README.md`](packages/action/README.md).

## Install

```bash
pnpm install
```

Requires Node.js ≥ 20 and [pnpm](https://pnpm.io).

## Build

```bash
pnpm build
# or
pnpm exec turbo build
```

Typecheck only:

```bash
pnpm typecheck
```

## Develop

```bash
pnpm --filter @shtd/web dev
```

## Docs

Product docs (dogfood): [`docs/`](docs/README.md) — start with the **[full tutorial](docs/tutorial.md)**; also [cheatsheet](docs/cheatsheet.md), [architecture](docs/architecture.md), [CLI](docs/cli.md), [Action](docs/action.md), [dashboard](docs/dashboard.md), [getting started](docs/getting-started.md).

## Monorepo layout

```
apps/web/              Next.js dashboard (App Router)
packages/core/         Healing engine
packages/cli/          shtd CLI
packages/action/       GitHub Action wrapper
packages/db/           Drizzle schema
packages/shared/       Shared Zod types & config
docs/                  Product docs (dogfood)
examples/sample-repo/  Fixture repo with planted drift
scripts/               e2e-sample-repo.mjs
```

## Config

Repos may include `shtd.config.json` (see `@shtd/shared` `ShtdConfigSchema`):

```json
{
  "docs": ["docs/**/*.{md,mdx}"],
  "openapi": ["openapi/**/*.{yaml,yml,json}"],
  "ignore": ["**/node_modules/**"],
  "autoMerge": { "enabled": false, "minConfidence": "high", "requireGreenCi": true }
}
```

## GitHub Action

Composite action at [`packages/action`](packages/action) — see its [README](packages/action/README.md).

Dogfood workflow: [`.github/workflows/shtd.yml`](.github/workflows/shtd.yml) (`pull_request`, `push`, `schedule`, `workflow_dispatch`).

Sample fixture workflow: [`.github/workflows/shtd-sample.yml`](.github/workflows/shtd-sample.yml).

```bash
pnpm install
pnpm --filter @shtd/cli... build
# then uses: ./packages/action
```

## Status

Engine + CLI + GitHub Action + dashboard (demo/seed) + dogfood docs/workflows + `pnpm test:e2e`.
