# Web dashboard

App: [`apps/web`](../apps/web) (`@shtd/web`) — Next.js App Router UI over `@shtd/db` / demo seed data.

## Run locally

```bash
pnpm install
pnpm --filter @shtd/web dev
```

Open [http://localhost:3000](http://localhost:3000). Without `DATABASE_URL` and GitHub OAuth env vars, the app runs in **demo mode** with seeded repos/runs/findings (see `apps/web/.env.example`).

```bash
# Optional: copy and fill for a live Postgres + GitHub OAuth session
cp apps/web/.env.example apps/web/.env.local
```

## Pages

| Route | Purpose |
|---|---|
| `/` | Overview stats + latest runs |
| `/repos` | Connected repositories |
| `/runs` · `/runs/[id]` | Scan/heal run list and detail |
| `/findings` | Findings across runs |
| `/review` | Accept / reject proposed patches |
| `/feedback` | Reader feedback inbox |
| `/settings` | Docs paths, auto-merge, schedule hints |

## API (selected)

| Method | Path | Notes |
|---|---|---|
| `GET`/`POST` | `/api/repos` | List / connect repos |
| `GET` | `/api/runs` · `/api/runs/[id]` | Runs |
| `GET`/`PATCH` | `/api/findings` · `/api/findings/[id]` | Findings + review actions |
| `POST` | `/api/feedback` | Public/CORS “report inaccuracy” → `kind: feedback` finding |
| `GET` | `/api/auth/github` · `/api/auth/callback` | GitHub OAuth |
| `GET` | `/api/auth/logout` | Sign out |

Embeddable widget: `/embed.js` (served by the web app) posts to `/api/feedback`.

## Auth

Sign in with GitHub when OAuth env vars are set. Demo mode uses a seeded session so you can click through the UI without a database.
