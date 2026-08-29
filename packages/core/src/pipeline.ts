import type {
  HealFinding,
  Run,
  RunStats,
  ShtdConfig,
} from "@shtd/shared";
import { loadConfig } from "./config.js";
import { runDetectors } from "./detect/index.js";
import { buildDocGraph, summarizeGraph } from "./ingest/graph.js";
import { ingestRepo } from "./ingest/index.js";
import {
  constrainPatchesToDocs,
  createLlmProvider,
  generatePatches,
  type FilePatch,
  type LlmProvider,
} from "./heal/index.js";
import {
  evaluateAutoMergePolicy,
  type AutoMergeDecision,
} from "./automerge.js";
import { runId } from "./util/ids.js";
import { isDirectory } from "./util/fs.js";

export interface ScanOptions {
  config?: ShtdConfig;
  trigger?: Run["trigger"];
  /** Extra feedback items to turn into findings (API / CLI). */
  feedback?: Array<{
    id?: string;
    page: string;
    note: string;
    quote?: string | null;
  }>;
}

export interface ScanResult {
  run: Run;
  config: ShtdConfig;
  graphSummary: { nodeCount: number; edgeCount: number; pages: number };
}

export interface HealOptions extends ScanOptions {
  /** Attempt to open a GitHub PR (needs GITHUB_TOKEN + repo). */
  pr?: boolean;
  /** LLM provider override. */
  provider?: LlmProvider;
  /** Write patched docs to disk. */
  apply?: boolean;
}

export interface HealResult extends ScanResult {
  patches: FilePatch[];
  prUrl?: string;
  prSkippedReason?: string;
  autoMerge?: AutoMergeDecision;
}

function buildStats(findings: HealFinding[], pagesScanned: number, durationMs: number): RunStats {
  const findingsByKind: Record<string, number> = {};
  const findingsByConfidence = { high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    findingsByKind[f.kind] = (findingsByKind[f.kind] ?? 0) + 1;
    findingsByConfidence[f.confidence] += 1;
  }
  return {
    findingsTotal: findings.length,
    findingsByKind,
    findingsByConfidence,
    pagesScanned,
    durationMs,
  };
}

/** Detect-only pipeline. */
export async function scan(
  repoPath: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const id = runId();

  if (!(await isDirectory(repoPath))) {
    const run: Run = {
      id,
      trigger: options.trigger ?? "cli",
      status: "failed",
      repoPath,
      startedAt,
      finishedAt: new Date().toISOString(),
      findings: [],
      error: `Not a directory: ${repoPath}`,
    };
    return {
      run,
      config: options.config ?? (await loadConfig(repoPath).catch(() => ({}) as ShtdConfig)),
      graphSummary: { nodeCount: 0, edgeCount: 0, pages: 0 },
    };
  }

  const config = options.config ?? (await loadConfig(repoPath));
  try {
    const index = await ingestRepo(repoPath, config);
    const graph = buildDocGraph(index);
    const findings = await runDetectors(index, graph, {
      feedback: options.feedback,
    });
    const durationMs = Date.now() - t0;
    const run: Run = {
      id,
      trigger: options.trigger ?? "cli",
      status: "completed",
      repoPath,
      startedAt,
      finishedAt: new Date().toISOString(),
      stats: buildStats(findings, index.pages.length, durationMs),
      findings,
    };
    return { run, config, graphSummary: summarizeGraph(graph) };
  } catch (err) {
    const run: Run = {
      id,
      trigger: options.trigger ?? "cli",
      status: "failed",
      repoPath,
      startedAt,
      finishedAt: new Date().toISOString(),
      findings: [],
      error: err instanceof Error ? err.message : String(err),
    };
    return {
      run,
      config,
      graphSummary: { nodeCount: 0, edgeCount: 0, pages: 0 },
    };
  }
}

/** Detect + propose patches (docs-only). Optionally open a PR / evaluate auto-merge. */
export async function heal(
  repoPath: string,
  options: HealOptions = {},
): Promise<HealResult> {
  const scanResult = await scan(repoPath, options);
  if (scanResult.run.status === "failed") {
    return { ...scanResult, patches: [] };
  }

  const config = scanResult.config;
  const index = await ingestRepo(repoPath, config);
  const provider = options.provider ?? createLlmProvider(config);
  const { findings, patches: rawPatches } = await generatePatches(
    index,
    scanResult.run.findings,
    provider,
  );
  const patches = constrainPatchesToDocs(rawPatches, config);

  if (options.apply) {
    const { writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    for (const p of patches) {
      if (p.newContent !== undefined) {
        await writeFile(join(repoPath, p.path), p.newContent, "utf8");
      }
    }
  }

  const durationMs =
    (scanResult.run.stats?.durationMs ?? 0) +
    Math.max(0, Date.now() - Date.parse(scanResult.run.startedAt ?? new Date().toISOString()));

  const run: Run = {
    ...scanResult.run,
    findings,
    stats: buildStats(findings, index.pages.length, durationMs),
    finishedAt: new Date().toISOString(),
  };

  const autoMerge = evaluateAutoMergePolicy(findings, config);

  let prUrl: string | undefined;
  let prSkippedReason: string | undefined;

  if (options.pr) {
    const { maybeCreatePullRequest } = await import("./github.js");
    const pr = await maybeCreatePullRequest(repoPath, run, patches, config, {
      autoMerge,
    });
    prUrl = pr.url;
    prSkippedReason = pr.skippedReason;
  }

  return {
    run,
    config,
    graphSummary: scanResult.graphSummary,
    patches,
    prUrl,
    prSkippedReason,
    autoMerge,
  };
}
