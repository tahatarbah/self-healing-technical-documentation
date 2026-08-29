import { createHash } from "node:crypto";

/** Stable short id for a finding. */
export function findingId(
  kind: string,
  path: string,
  key: string,
): string {
  const hash = createHash("sha1")
    .update(`${kind}|${path}|${key}`)
    .digest("hex")
    .slice(0, 10);
  return `${kind}:${hash}`;
}

export function runId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
