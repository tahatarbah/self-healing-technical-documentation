import type { HealFinding } from "@shtd/shared";
import type { DocGraph } from "../ingest/graph.js";
import type { RepoIndex } from "../ingest/index.js";
import { findingsFromFeedback, loadLocalFeedback } from "../feedback.js";
import { detectDrift } from "./drift.js";
import { detectBrokenLinks } from "./links.js";
import { detectOpenApiMismatch } from "./openapi.js";
import { detectExampleFailures } from "./examples.js";

export { detectDrift } from "./drift.js";
export { detectBrokenLinks } from "./links.js";
export { detectOpenApiMismatch } from "./openapi.js";
export { detectExampleFailures } from "./examples.js";

export interface DetectorOptions {
  /** Extra feedback items (e.g. from API) merged with `.shtd/feedback.jsonl`. */
  feedback?: Array<{
    id?: string;
    page: string;
    note: string;
    quote?: string | null;
  }>;
}

export async function runDetectors(
  index: RepoIndex,
  _graph?: DocGraph,
  options: DetectorOptions = {},
): Promise<HealFinding[]> {
  const localFeedback = await loadLocalFeedback(index.repoPath);
  const openLocal = localFeedback.filter((f) => f.status !== "dismissed");
  const feedbackItems = [
    ...openLocal.map((f) => ({
      id: f.id,
      page: f.page,
      note: f.note,
      quote: f.quote,
    })),
    ...(options.feedback ?? []),
  ];

  const [links, drift, openapi, examples, feedback] = await Promise.all([
    detectBrokenLinks(index),
    Promise.resolve(detectDrift(index)),
    Promise.resolve(detectOpenApiMismatch(index)),
    Promise.resolve(detectExampleFailures(index)),
    Promise.resolve(findingsFromFeedback(feedbackItems)),
  ]);

  return aggregateFindings([
    ...drift,
    ...links,
    ...openapi,
    ...examples,
    ...feedback,
  ]);
}

/** Dedupe by id; prefer higher-information evidence. */
export function aggregateFindings(findings: HealFinding[]): HealFinding[] {
  const byId = new Map<string, HealFinding>();
  for (const f of findings) {
    const prev = byId.get(f.id);
    if (!prev) {
      byId.set(f.id, f);
      continue;
    }
    // Keep the one with more detail / a patch
    const prevScore =
      (prev.evidence.details?.length ?? 0) + (prev.patch ? 1000 : 0);
    const nextScore =
      (f.evidence.details?.length ?? 0) + (f.patch ? 1000 : 0);
    if (nextScore > prevScore) byId.set(f.id, f);
  }
  return [...byId.values()].sort((a, b) => {
    const kindCmp = a.kind.localeCompare(b.kind);
    if (kindCmp !== 0) return kindCmp;
    return a.path.localeCompare(b.path);
  });
}
