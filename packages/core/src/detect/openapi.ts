import type { HealFinding } from "@shtd/shared";
import type { RepoIndex } from "../ingest/index.js";
import { findingId } from "../util/ids.js";

/** Compare doc OpenAPI references against ingested specs. */
export function detectOpenApiMismatch(index: RepoIndex): HealFinding[] {
  if (index.openapi.length === 0) return [];

  const findings: HealFinding[] = [];
  const allOpIds = new Set<string>();
  const allPaths = new Set<string>();
  const opsByPathMethod = new Map<
    string,
    { operationId?: string; queryParams: Set<string> }
  >();

  for (const spec of index.openapi) {
    for (const id of spec.operationIds) allOpIds.add(id);
    for (const p of spec.paths) allPaths.add(p);
    for (const op of spec.operations) {
      const key = `${op.method} ${op.path}`;
      opsByPathMethod.set(key, {
        operationId: op.operationId,
        queryParams: new Set(
          op.parameters.filter((p) => p.in === "query").map((p) => p.name),
        ),
      });
    }
  }

  const primarySpec = index.openapi[0]!;

  for (const page of index.pages) {
    for (const opId of page.openApiRefs.operationIds) {
      if (!allOpIds.has(opId)) {
        // Suggest rename remove→delete
        let hint = "";
        if (opId.startsWith("remove")) {
          const alt = "delete" + opId.slice("remove".length);
          if (allOpIds.has(alt)) hint = ` Spec has \`${alt}\` instead.`;
        }
        findings.push({
          id: findingId("openapi_mismatch", page.relPath, opId),
          kind: "openapi_mismatch",
          path: page.relPath,
          confidence: "high",
          status: "open",
          message: `Docs reference operationId \`${opId}\` missing from OpenAPI${hint ? " (renamed?)" : ""}`,
          evidence: {
            summary: `Docs reference operationId \`${opId}\` absent from OpenAPI`,
            details:
              hint.trim() ||
              `Checked operationIds in \`${primarySpec.relPath}\`; \`${opId}\` is not defined.`,
            docPath: page.relPath,
            sourcePath: primarySpec.relPath,
            expected: opId,
            actual: hint.includes("`")
              ? (hint.match(/`([^`]+)`/)?.[1] ?? "not in spec")
              : "not in spec",
          },
        });
      }
    }

    for (const pref of page.openApiRefs.paths) {
      const path = pref.path;
      // Exact path check
      if (!allPaths.has(path)) {
        // Also try without /v1 prefix variants
        const stripped = path.replace(/^\/v\d+/, "");
        const foundAlt = allPaths.has(stripped);
        findings.push({
          id: findingId(
            "openapi_mismatch",
            page.relPath,
            `${pref.method ?? ""} ${path}`,
          ),
          kind: "openapi_mismatch",
          path: page.relPath,
          confidence: "high",
          status: "open",
          message: `Docs reference \`${pref.method ?? "?"} ${path}\` not present in OpenAPI`,
          evidence: {
            summary: `Docs path \`${pref.method ?? "?"} ${path}\` not in OpenAPI`,
            details: foundAlt
              ? `Spec has \`${stripped}\` but not \`${path}\` (prefix mismatch?).`
              : `No matching path in \`${primarySpec.relPath}\`.`,
            docPath: page.relPath,
            sourcePath: primarySpec.relPath,
            expected: `${pref.method ?? "?"} ${path}`,
            actual: foundAlt ? stripped : "path missing",
          },
        });
      }
    }

    for (const qp of page.openApiRefs.queryParams) {
      if (!qp.param) continue;
      const pathHint = qp.pathHint ?? "/widgets";
      // Find GET for path
      const getOp =
        opsByPathMethod.get(`GET ${pathHint}`) ??
        [...opsByPathMethod.entries()].find(
          ([k]) => k.startsWith("GET ") && k.includes(pathHint),
        )?.[1];

      if (getOp && !getOp.queryParams.has(qp.param)) {
        const actual = [...getOp.queryParams].join(", ") || "(none)";
        findings.push({
          id: findingId(
            "openapi_mismatch",
            page.relPath,
            `query:${pathHint}:${qp.param}`,
          ),
          kind: "openapi_mismatch",
          path: page.relPath,
          confidence: "high",
          status: "open",
          message: `Docs mention query param \`${qp.param}\` for \`${pathHint}\` but OpenAPI has: ${actual}`,
          evidence: {
            summary: `Query param \`${qp.param}\` documented for \`${pathHint}\` but not in OpenAPI`,
            details: `Docs say \`${qp.param}\`; OpenAPI GET query params: ${actual}.`,
            docPath: page.relPath,
            sourcePath: primarySpec.relPath,
            expected: qp.param,
            actual: [...getOp.queryParams].includes("cursor")
              ? "cursor"
              : actual,
          },
        });
      }
    }
  }

  return dedupe(findings);
}

function dedupe(findings: HealFinding[]): HealFinding[] {
  const map = new Map<string, HealFinding>();
  for (const f of findings) map.set(f.id, f);
  return [...map.values()];
}
