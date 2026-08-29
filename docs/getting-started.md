# Getting started

## Install & build

```bash
pnpm install
pnpm --filter @shtd/cli... build
```

Requires Node.js ≥ 20 and [pnpm](https://pnpm.io).

## Scan the sample fixture

`examples/sample-repo` plants known drift, broken links, OpenAPI mismatches, and bad examples (see [FIXTURES.md](../examples/sample-repo/FIXTURES.md)). **Do not “fix” those docs** — they are the regression oracle.

```bash
node packages/cli/dist/index.js scan examples/sample-repo
node packages/cli/dist/index.js scan examples/sample-repo --json -o shtd-report.json
```

## E2E fixture check

Builds the CLI, scans the sample repo, and asserts minimum finding counts by kind from FIXTURES.md. Exits non-zero on regression.

```bash
pnpm test:e2e
# or
node scripts/e2e-sample-repo.mjs
```

## Dashboard

```bash
pnpm --filter @shtd/web dev
```

Opens at http://localhost:3000 (demo mode without `DATABASE_URL` / OAuth). Details: [dashboard.md](./dashboard.md).

## GitHub Action

Workflows already live in this repo:

- [`.github/workflows/shtd.yml`](../.github/workflows/shtd.yml) — dogfood heal/scan
- [`.github/workflows/shtd-sample.yml`](../.github/workflows/shtd-sample.yml) — sample-repo scan

Usage guide: [action.md](./action.md).

## Feedback → heal finding

```bash
# Local queue (.shtd/feedback.jsonl) — surfaced on next scan/heal
node packages/cli/dist/index.js feedback add \
  --page docs/api.md \
  --note "Pagination section is wrong" \
  examples/sample-repo

node packages/cli/dist/index.js scan --trigger feedback examples/sample-repo
```

Dashboard: `POST /api/feedback` (CORS) or embed `/embed.js`. Each report creates a `kind: feedback` finding.

## Scheduled scans

Cron-friendly (exit 0 unless the engine fails; findings are not failures):

```cron
0 6 * * 1 cd /path/to/repo && shtd scan --trigger schedule --json -o /var/shtd/scan.json
```

Put the cron expression in `shtd.config.json` → `schedule.cron`. The GitHub Action workflow owns the actual schedule timer (see `shtd.yml`).

## Auto-merge (high confidence only)

In `shtd.config.json`:

```json
{ "autoMerge": { "enabled": true, "minConfidence": "high", "requireGreenCi": true } }
```

```bash
# Stub green CI until Checks API is wired
SHTD_CI_STATUS=success node packages/cli/dist/index.js heal --pr --trigger schedule examples/sample-repo
```

If any patched finding is below `high`, or CI status is unknown, the engine opens a PR for review instead of auto-merge.
