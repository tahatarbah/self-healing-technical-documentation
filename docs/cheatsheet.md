# SHTD cheatsheet

Quick command and config reference. Full narrative: [tutorial.md](./tutorial.md).

## Install / build

```bash
pnpm install
pnpm --filter @shtd/cli... build
pnpm build
pnpm typecheck
pnpm test:e2e
```

## CLI (`node packages/cli/dist/index.js …`)

```bash
# Scan
shtd scan [path]
shtd scan examples/sample-repo --json -o shtd-report.json
shtd scan --trigger schedule examples/sample-repo --json

# Heal
shtd heal [path]
shtd heal examples/sample-repo --apply --json -o heal-report.json
SHTD_CI_STATUS=success shtd heal --pr --trigger schedule examples/sample-repo

# Feedback
shtd feedback add --page docs/api.md --note "…" [--quote "…"] [--api http://localhost:3000] [path]

# Help
shtd help
```

### Flags

| Flag | Commands | Meaning |
|---|---|---|
| `--json` | scan, heal, feedback | JSON to stdout |
| `-o` / `--out` | scan, heal | Write JSON report file |
| `--trigger` | scan, heal | `cli` \| `github_action` \| `schedule` \| `feedback` \| `manual` |
| `--apply` | heal | Write docs-only patches to disk |
| `--pr` | heal | Attempt PR (core dry-run unless `SHTD_PR_DRY_RUN=0`) |
| `--page` / `--note` / `--quote` / `--api` | feedback add | Required page+note; optional quote + dashboard POST |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success (findings ≠ failure) |
| `1` | Engine/config/API failure |
| `2` | Usage error |

## Dashboard

```bash
pnpm --filter @shtd/web dev
# http://localhost:3000 — demo mode without DATABASE_URL / OAuth
```

Routes: `/` · `/repos` · `/runs` · `/findings` · `/review` · `/feedback` · `/settings`

Embed: `/embed.js` → `POST /api/feedback`

## Action

```yaml
- run: pnpm --filter @shtd/cli... build
- uses: ./packages/action
  with:
    path: .
    mode: heal   # or scan
    create-pr: "true"
    comment-on-pr: "true"
    report-path: shtd-report.json
```

Workflows: `.github/workflows/shtd.yml` · `shtd-sample.yml`

## Config (`shtd.config.json`)

```json
{
  "docs": ["docs/**/*.{md,mdx}"],
  "openapi": ["openapi/**/*.{yaml,yml,json}"],
  "ignore": ["**/node_modules/**"],
  "healPaths": ["docs/**", "**/*.md", "**/*.mdx"],
  "autoMerge": { "enabled": false, "minConfidence": "high", "requireGreenCi": true },
  "schedule": { "enabled": false, "cron": "0 6 * * 1" },
  "prLabels": ["self-heal"],
  "llm": { "provider": "anthropic" }
}
```

## Finding kinds

`drift` · `broken_link` · `broken_anchor` · `orphan_page` · `broken_image` · `openapi_mismatch` · `example_failure` · `feedback`

## Env

| Var | Use |
|---|---|
| `ANTHROPIC_API_KEY` | LLM heal patches |
| `GITHUB_TOKEN` / `GH_TOKEN` | PR creation |
| `SHTD_PR_DRY_RUN=0` | Allow core `--pr` to call `gh` |
| `SHTD_CI_STATUS=success` | Stub green CI for auto-merge |
| `DATABASE_URL` | Dashboard Postgres (omit = demo seed) |
| `GITHUB_CLIENT_ID` / `SECRET` / `AUTH_SECRET` | Dashboard OAuth |

## Fixture

```bash
node packages/cli/dist/index.js scan examples/sample-repo
# Do not “fix” planted docs — see examples/sample-repo/FIXTURES.md
```
