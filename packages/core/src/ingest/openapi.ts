import { parse as parseYaml } from "yaml";
import { readText, repoRelative } from "../util/fs.js";

export interface OpenApiOperation {
  method: string;
  path: string;
  operationId?: string;
  parameters: Array<{ name: string; in: string }>;
}

export interface OpenApiIndex {
  absPath: string;
  relPath: string;
  operationIds: Set<string>;
  /** method+path → operation */
  operations: OpenApiOperation[];
  paths: Set<string>;
}

interface RawSpec {
  paths?: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        parameters?: Array<{ name?: string; in?: string }>;
      }
    >
  >;
}

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);

export async function ingestOpenApi(
  repoPath: string,
  absPath: string,
): Promise<OpenApiIndex> {
  const raw = await readText(absPath);
  const isJson = absPath.endsWith(".json");
  const spec = (
    isJson ? JSON.parse(raw) : parseYaml(raw)
  ) as RawSpec;

  const operationIds = new Set<string>();
  const paths = new Set<string>();
  const operations: OpenApiOperation[] = [];

  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    paths.add(path);
    for (const [method, op] of Object.entries(methods ?? {})) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      const operationId = op.operationId;
      if (operationId) operationIds.add(operationId);
      operations.push({
        method: method.toUpperCase(),
        path,
        operationId,
        parameters: (op.parameters ?? [])
          .filter((p) => p.name && p.in)
          .map((p) => ({ name: p.name!, in: p.in! })),
      });
    }
  }

  return {
    absPath,
    relPath: repoRelative(repoPath, absPath),
    operationIds,
    operations,
    paths,
  };
}
