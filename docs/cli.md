# CLI (`shtd`)

Package: `@shtd/cli` · binary: `shtd` (`packages/cli/bin/shtd.js` → `dist/index.js`).

## Build

```bash
pnpm install
pnpm --filter @shtd/cli... build
```

## Commands

### `shtd scan [path]`

Detect only. Exit **0** when the engine completes (findings are not failures). Exit **1** if the run status is `failed`. Exit **2** for usage errors (bad flags).

Human output groups findings by kind (counts + lines). Use `--json` for CI.

```bash
# Human summary (grouped by kind)
node packages/cli/dist/index.js scan examples/sample-repo

# JSON to stdout
node packages/cli/dist/index.js scan examples/sample-repo --json

# Write report file
node packages/cli/dist/index.js scan examples/sample-repo --json -o shtd-report.json

# Trigger metadata (persisted on the run)
node packages/cli/dist/index.js scan --trigger schedule examples/sample-repo --json
```

### `shtd heal [path]`

Detect + propose docs-only patches. Without `ANTHROPIC_API_KEY`, mechanical fixes still run (`MockProvider`); LLM rewrites require Anthropic.

| Flag | Meaning |
|---|---|
| `--apply` | Write patches into the working tree (docs paths only) |
| `--pr` | Attempt a GitHub PR when a token is available |
| `--json` / `-o` | Same report options as `scan` |
| `--trigger` | `cli` \| `github_action` \| `schedule` \| `feedback` \| `manual` |

```bash
node packages/cli/dist/index.js heal examples/sample-repo --json
SHTD_CI_STATUS=success node packages/cli/dist/index.js heal --pr --trigger schedule examples/sample-repo
```

### `shtd feedback add`

Enqueue a local reader report (`.shtd/feedback.jsonl`). Surfaced as `kind: feedback` on the next scan/heal. Optionally POST to the dashboard.

```bash
node packages/cli/dist/index.js feedback add \
  --page docs/api.md \
  --note "Pagination section is wrong" \
  --quote "listWidgets({ page" \
  examples/sample-repo

# Also POST to the web API
node packages/cli/dist/index.js feedback add \
  --page docs/api.md \
  --note "Stale claim" \
  --api http://localhost:3000 \
  examples/sample-repo
```

### `shtd help`

Prints usage (same as `-h` / `--help`), including exit codes.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — scan/heal completed (findings do **not** fail the process) |
| `1` | Engine/run failure, API feedback error, or invalid config |
| `2` | Usage error — unknown flag, invalid `--trigger`, missing `--page`/`--note` |

## Report shape

JSON reports are `ScanReport` version 1 (`@shtd/core`): `run` (status, stats, findings), optional `graph`, `patches`, `prUrl`, `autoMerge`, `configSummary`.

## Config

Loads `shtd.config.json` from the target path. Schema: `ShtdConfigSchema` in `@shtd/shared`.

| Field | Default | Notes |
|---|---|---|
| `docs` | `docs/**/*.{md,mdx}`, `**/*.md` | Ingest globs |
| `openapi` | `[]` | Spec paths |
| `healPaths` | `docs/**`, `**/*.md`, `**/*.mdx` | Docs-only patch allowlist |
| `autoMerge` | `enabled: false`, `minConfidence: high`, `requireGreenCi: true` | High-confidence auto-merge policy |
| `schedule` | `enabled: false`, `cron: "0 6 * * 1"` | Hint for Action YAML / cron |
| `ignore` | `node_modules`, `.git` | Skip globs |
| `llm.provider` | `anthropic` | Falls back to mock without API key |

Missing file → defaults. Invalid JSON or schema → clear field errors and exit **1**.
