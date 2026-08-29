import type { HealFinding, Run, ShtdConfig } from "@shtd/shared";
import type { FilePatch } from "./heal/patch.js";

import type { AutoMergeDecision } from "./automerge.js";

export interface ScanReport {
  version: 1;
  tool: "shtd";
  command: "scan" | "heal";
  repoPath: string;
  generatedAt: string;
  run: Run;
  graph?: { nodeCount: number; edgeCount: number; pages: number };
  patches?: Array<{
    path: string;
    findingIds: string[];
    unifiedDiff: string;
  }>;
  prUrl?: string;
  prSkippedReason?: string;
  autoMerge?: AutoMergeDecision;
  configSummary?: {
    docs: string[];
    openapi: string[];
    healPaths: string[];
    autoMergeEnabled?: boolean;
    scheduleCron?: string;
  };
}

export function toScanReport(input: {
  command: "scan" | "heal";
  repoPath: string;
  run: Run;
  graphSummary?: { nodeCount: number; edgeCount: number; pages: number };
  patches?: FilePatch[];
  prUrl?: string;
  prSkippedReason?: string;
  autoMerge?: AutoMergeDecision;
  config?: ShtdConfig;
}): ScanReport {
  return {
    version: 1,
    tool: "shtd",
    command: input.command,
    repoPath: input.repoPath,
    generatedAt: new Date().toISOString(),
    run: input.run,
    graph: input.graphSummary,
    patches: input.patches?.map((p) => ({
      path: p.path,
      findingIds: p.findingIds,
      unifiedDiff: p.unifiedDiff,
    })),
    prUrl: input.prUrl,
    prSkippedReason: input.prSkippedReason,
    autoMerge: input.autoMerge,
    configSummary: input.config
      ? {
          docs: input.config.docs,
          openapi: input.config.openapi,
          healPaths: input.config.healPaths,
          autoMergeEnabled: input.config.autoMerge.enabled,
          scheduleCron: input.config.schedule.enabled
            ? input.config.schedule.cron
            : undefined,
        }
      : undefined,
  };
}

/** Human-readable summary with findings grouped by kind. */
export function formatHumanSummary(run: Run): string {
  const lines: string[] = [];
  const stats = run.stats;
  const total = stats?.findingsTotal ?? run.findings.length;
  lines.push(`Status: ${run.status} — ${total} finding(s)`);

  if (stats?.findingsByConfidence) {
    const c = stats.findingsByConfidence;
    lines.push(
      `Confidence: high=${c.high}  medium=${c.medium}  low=${c.low}`,
    );
  }

  if (stats?.pagesScanned != null) {
    lines.push(`Pages scanned: ${stats.pagesScanned}`);
  }
  if (stats?.durationMs != null) {
    lines.push(`Duration: ${stats.durationMs}ms`);
  }

  // Group findings by kind (stable sort of kinds)
  const byKind = new Map<string, HealFinding[]>();
  for (const f of run.findings) {
    const list = byKind.get(f.kind) ?? [];
    list.push(f);
    byKind.set(f.kind, list);
  }

  const kinds = [...byKind.keys()].sort((a, b) => a.localeCompare(b));
  if (kinds.length === 0) {
    lines.push("");
    lines.push("No findings.");
    return lines.join("\n");
  }

  for (const kind of kinds) {
    const group = byKind.get(kind)!;
    lines.push("");
    lines.push(`${kind} (${group.length})`);
    for (const f of group) {
      lines.push(formatFindingLine(f));
    }
  }

  return lines.join("\n");
}

export function formatFindingLine(f: HealFinding): string {
  const conf = f.confidence;
  const patch = f.patch ? " [patch]" : "";
  const evidenceHint =
    f.evidence.expected && f.evidence.actual
      ? ` (${truncate(f.evidence.expected, 40)} → ${truncate(f.evidence.actual, 40)})`
      : "";
  return `  - [${conf}] ${f.path}: ${f.message ?? f.evidence.summary}${evidenceHint}${patch}`;
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}
