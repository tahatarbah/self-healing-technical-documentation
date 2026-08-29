# OpenAPI usage

This guide references OpenAPI operations that no longer exist in `openapi/openapi.yaml`.

## Deprecated operations (planted stale refs)

Docs still mention:

- `operationId: removeWidget` — removed; replaced by `deleteWidget`
- `POST /v1/widgets/bulk` — never shipped / removed from spec
- `GET /widgets` query param `page` — spec now uses `cursor`

See the live spec at [`../openapi/openapi.yaml`](../openapi/openapi.yaml).

Broken image path (planted): ![architecture](./images/architecture.png)
