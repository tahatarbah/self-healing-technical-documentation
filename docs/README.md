# Product documentation

Dogfood docs for **Self-Healing Technical Documentation (SHTD)** — this monorepo’s own `/docs`, kept in sync with the shipped CLI, Action, and dashboard.

## Guides

| Doc | Contents |
|---|---|
| [**Tutorial**](./tutorial.md) | Full end-to-end technical tutorial (start here) |
| [Cheatsheet](./cheatsheet.md) | Command / config / env quick reference |
| [Architecture](./architecture.md) | Engine pipeline, packages, finding kinds, auto-merge |
| [CLI](./cli.md) | `shtd scan` / `heal` / `feedback` |
| [GitHub Action](./action.md) | Composite action + workflows in this repo |
| [Dashboard](./dashboard.md) | Next.js UI, routes, feedback API |
| [Getting started](./getting-started.md) | Install, sample scan, e2e, feedback, schedule |

## Quick links

- **[Full tutorial](./tutorial.md)** — end-to-end walkthrough
- [Cheatsheet](./cheatsheet.md) — commands & env
- Root [README](../README.md) — install, build, quickstart
- Fixture planted failures: [`examples/sample-repo/FIXTURES.md`](../examples/sample-repo/FIXTURES.md)
- Dogfood workflow: [`.github/workflows/shtd.yml`](../.github/workflows/shtd.yml)
- Sample scan workflow: [`.github/workflows/shtd-sample.yml`](../.github/workflows/shtd-sample.yml)
- Action package: [`packages/action/README.md`](../packages/action/README.md)

## Configuration

Repos may include `shtd.config.json` (see `@shtd/shared` `ShtdConfigSchema` and root [README](../README.md#config)).
