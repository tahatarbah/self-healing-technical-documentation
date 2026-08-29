# GitHub Action

Package: [`packages/action`](../packages/action) — composite action that wraps the **built** CLI.

Full input/output reference: [`packages/action/README.md`](../packages/action/README.md).

## Workflows in this repo

| Workflow | File | Purpose |
|---|---|---|
| **shtd** | [`.github/workflows/shtd.yml`](../.github/workflows/shtd.yml) | Dogfood: scan/heal this monorepo on `pull_request`, `push` to main/master, weekly schedule, and `workflow_dispatch` |
| **shtd-sample** | [`.github/workflows/shtd-sample.yml`](../.github/workflows/shtd-sample.yml) | Scan `examples/sample-repo` on path-filtered PRs and dispatch |

Both check out the repo, install with pnpm, build `@shtd/cli...`, then `uses: ./packages/action`.

## Minimal consumer pattern

```yaml
permissions:
  contents: write
  pull-requests: write

jobs:
  shtd:
    runs-on: ubuntu-latest
    steps:
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
      - id: shtd
        uses: ./packages/action   # or owner/repo/packages/action@ref
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          path: .
          mode: heal
          create-pr: ${{ github.event_name != 'pull_request' }}
          comment-on-pr: ${{ github.event_name == 'pull_request' }}
          report-path: shtd-report.json
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: shtd-report
          path: ${{ steps.shtd.outputs.report-path }}
```

## Behavior notes

- Checkout is **not** inside the action — the workflow must check out and build first.
- `mode: scan` detects only; `mode: heal` can apply patches and open a heal PR (`create-pr`).
- On PRs, dogfood typically comments a summary instead of opening a heal PR.
- Report artifact defaults to `shtd-report.json` (override with `report-path`).

Example workflow snippet also lives at [`packages/action/examples/shtd.yml`](../packages/action/examples/shtd.yml).
