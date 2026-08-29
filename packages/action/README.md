# `@shtd/action`

Composite GitHub Action that wraps the `shtd` CLI to scan or heal documentation drift in CI.

## What it does

1. Runs `shtd scan` or `shtd heal --apply` using the **built** CLI (`packages/cli/dist`).
2. Writes a JSON report (default `shtd-report.json`) for artifact upload.
3. Optionally commits docs-only patches and opens a heal PR (`create-pr`).
4. On `pull_request` events, optionally upserts a summary comment (`comment-on-pr`).

Checkout is **not** included — your workflow must check out the repo and build the CLI first.

## Prerequisites (workflow)

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- uses: pnpm/action-setup@v4
  with:
    version: 9

- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm

- run: pnpm install --frozen-lockfile
- run: pnpm --filter @shtd/cli... build
```

Requires Node.js ≥ 20. `gh` is available on GitHub-hosted runners (used for PR create/comment).

## Usage

```yaml
permissions:
  contents: write
  pull-requests: write

jobs:
  shtd:
    runs-on: ubuntu-latest
    steps:
      # … checkout, pnpm, build (see above) …

      - id: shtd
        uses: ./packages/action
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          path: .
          mode: heal
          # On PRs: comment findings. On push/schedule: open a heal PR.
          create-pr: ${{ github.event_name != 'pull_request' }}
          comment-on-pr: ${{ github.event_name == 'pull_request' }}
          report-path: shtd-report.json

      - uses: actions/upload-artifact@v4
        if: always() && steps.shtd.outputs.report-path != ''
        with:
          name: shtd-report
          path: ${{ steps.shtd.outputs.report-path }}
```

See also [`.github/workflows/shtd.yml`](../../.github/workflows/shtd.yml) in this monorepo.

### External / published use

Until the action is published to the Marketplace, reference it from this repository:

```yaml
uses: <owner>/<repo>/packages/action@<ref>
```

Consumers still need a built `shtd` on `PATH` or must set `shtd-bin` / vendor the monorepo packages.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `path` | `.` | Repo path to scan (relative to `working-directory`) |
| `token` | `${{ github.token }}` | GitHub token (`contents:write`, `pull-requests:write`) |
| `config` | _(empty)_ | Optional `shtd.config.json` copied into the scan path |
| `mode` | `heal` | `scan` or `heal` |
| `create-pr` | `true` | Open a heal PR when patches exist (`heal` only) |
| `apply` | `true` | Write docs patches before PR creation |
| `report-path` | `shtd-report.json` | JSON report path (upload as an artifact) |
| `comment-on-pr` | `true` | Upsert a summary comment on the triggering PR |
| `working-directory` | `.` | Monorepo root that contains `packages/cli` |
| `shtd-bin` | _(auto)_ | Override CLI invocation (default: `node …/packages/cli/dist/index.js`) |
| `pr-branch-prefix` | `shtd/heal` | Branch prefix for heal PRs |

## Outputs

| Output | Description |
| --- | --- |
| `report-path` | Absolute path to the JSON report |
| `finding-count` | Number of findings |
| `patch-count` | Number of patched files |
| `pr-url` | Heal PR URL when created |
| `status` | Run status (`completed` / `failed` / …) |

## JSON report artifact

Default path: **`shtd-report.json`** at the workspace root (override with `report-path`).

Shape (version 1) matches `@shtd/core` `ScanReport`: `run`, `findings`, optional `patches`, `prUrl`, etc.

Always upload it from the workflow:

```yaml
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: shtd-report
    path: ${{ steps.shtd.outputs.report-path }}
```

## Permissions

```yaml
permissions:
  contents: write      # push heal branch
  pull-requests: write # open PR + comment
```

## Local dry-run of scripts

After building the CLI:

```bash
pnpm --filter @shtd/cli... build

# Scan only (no PR / comment)
set INPUT_MODE=scan
set INPUT_PATH=examples/sample-repo
set INPUT_REPORT_PATH=shtd-report.json
set INPUT_WORKING_DIRECTORY=.
set GITHUB_WORKSPACE=%CD%
node packages/action/scripts/run-shtd.mjs
```

## Design notes

- Composite action (not a bundled Node action): CI installs pnpm, builds `@shtd/cli`, then runs these scripts.
- Heal PR flow (apply → commit docs paths → push branch → `gh pr create`) lives here; core’s `--pr` remains dry-run unless `SHTD_PR_DRY_RUN=0`.
- Summary comments are upserted via an HTML marker (`<!-- shtd-summary -->`) so re-runs update one comment.
