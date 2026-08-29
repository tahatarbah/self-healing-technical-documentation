# Planted failures (do not fix)

Detectors should report all of the following:

## Code–doc drift (`docs/api.md` vs `src/widgets.ts`)

| Doc says | Code has |
|---|---|
| `createWidget({ name })` → `{ id, name }` | requires `ownerId`; returns `Widget` with `status`, `createdAt` |
| `removeWidget(id)` | `deleteWidget(id): boolean` |
| `listWidgets({ page, limit })` | `listWidgets({ cursor, limit })` |

## Broken links / anchors / images

| Location | Issue |
|---|---|
| `docs/api.md` → `./deployment.md` | missing file |
| `docs/api.md` → `#advanced-filtering` | missing anchor |
| `docs/api.md` → `../CHANGELOG.md` | missing file |
| `docs/getting-started.md` → `./contributing.md` | missing file |
| `docs/openapi.md` → `./images/architecture.png` | missing image |

## Outdated OpenAPI references (`docs/openapi.md` vs `openapi/openapi.yaml`)

| Doc references | Spec has |
|---|---|
| `operationId: removeWidget` | `deleteWidget` only |
| `POST /v1/widgets/bulk` | path absent |
| `GET /widgets` query `page` | query `cursor` |

## Example validator (`docs/api.md` fences tagged `validate`)

| Example | Expected finding |
|---|---|
| `removeWidget("w_1")` | `example_failure` — renamed to `deleteWidget` |
| `function broken( {` | `example_failure` — parse/typecheck failure |

## Reader feedback

```bash
# Local queue → findings on next scan/heal
pnpm --filter @shtd/cli exec shtd feedback add \
  --page docs/api.md \
  --quote "Widgets are eventually consistent" \
  --note "No longer true after sync rewrite" \
  ./examples/sample-repo

pnpm --filter @shtd/cli exec shtd scan --json ./examples/sample-repo
```
