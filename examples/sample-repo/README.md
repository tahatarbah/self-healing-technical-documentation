# Sample Widget API

Fixture product used by Self-Healing Technical Documentation e2e tests.

This repo **intentionally** contains:

1. **Code–doc drift** — `docs/api.md` describes outdated function signatures vs `src/widgets.ts`
2. **Broken links** — relative links and anchors that do not resolve
3. **Outdated OpenAPI refs** — docs reference operations removed from `openapi/openapi.yaml`

Do not "fix" these failures; detectors should report them.
