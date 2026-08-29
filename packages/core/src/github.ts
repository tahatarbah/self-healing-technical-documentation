import type { Run, ShtdConfig } from "@shtd/shared";
import type { AutoMergeDecision } from "./automerge.js";
import type { FilePatch } from "./heal/patch.js";

export interface PrResult {
  url?: string;
  skippedReason?: string;
  /** Echo of auto-merge evaluation for the Action / CLI. */
  autoMerge?: AutoMergeDecision;
}

/**
 * Best-effort GitHub PR creation via `gh` CLI when GITHUB_TOKEN is set.
 *
 * Auto-merge policy (Phase 4):
 * - When `autoMerge.eligible`, we attempt `gh pr merge --auto --squash` after create
 *   (or report dry-run eligibility). CI green is stubbed via `SHTD_CI_STATUS=success`.
 * - Otherwise we only open a PR for human review.
 */
export async function maybeCreatePullRequest(
  _repoPath: string,
  run: Run,
  patches: FilePatch[],
  config: ShtdConfig,
  opts?: { autoMerge?: AutoMergeDecision },
): Promise<PrResult> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const autoMerge = opts?.autoMerge;

  if (!token) {
    return {
      skippedReason:
        "GITHUB_TOKEN / GH_TOKEN not set — skipping PR creation. Patches are in the JSON report.",
      autoMerge,
    };
  }

  if (patches.length === 0) {
    return { skippedReason: "No docs patches to open a PR for.", autoMerge };
  }

  const labels = [...config.prLabels];
  if (autoMerge?.eligible) {
    labels.push("auto-merge", "confidence:high");
  } else {
    labels.push("needs-review");
  }

  // Defer full git apply + gh pr create to the Action package unless dry-run off.
  if (process.env.SHTD_PR_DRY_RUN !== "0") {
    const mergeHint = autoMerge?.eligible
      ? ` Auto-merge eligible: ${autoMerge.reason}`
      : autoMerge
        ? ` Auto-merge blocked: ${autoMerge.reason}`
        : "";
    return {
      skippedReason: `PR mode: ${patches.length} docs-only patch file(s) ready; labels=${labels.join(",")}.${mergeHint} Set SHTD_PR_DRY_RUN=0 and ensure gh auth to create a PR (Action package owns full flow). Findings: ${run.stats?.findingsTotal ?? run.findings.length}.`,
      autoMerge,
    };
  }

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const body = [
      "## Self-heal findings",
      "",
      ...run.findings.map(
        (f) =>
          `- **${f.kind}** (\`${f.confidence}\`): ${f.message ?? f.evidence.summary}`,
      ),
      "",
      "Patches constrained to docs paths only.",
      "",
      autoMerge
        ? `### Auto-merge\n\n${autoMerge.eligible ? "✅" : "⏸️"} ${autoMerge.reason}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { stdout } = await execFileAsync(
      "gh",
      [
        "pr",
        "create",
        "--title",
        `docs: self-heal (${run.stats?.findingsTotal ?? run.findings.length} findings)`,
        "--body",
        body,
      ],
      {
        env: { ...process.env, GITHUB_TOKEN: token },
        cwd: _repoPath,
      },
    );
    const url = stdout.trim().split(/\r?\n/).filter(Boolean).pop();

    if (url && autoMerge?.eligible) {
      try {
        await execFileAsync(
          "gh",
          ["pr", "merge", url, "--auto", "--squash"],
          {
            env: { ...process.env, GITHUB_TOKEN: token },
            cwd: _repoPath,
          },
        );
      } catch (mergeErr) {
        return {
          url,
          skippedReason: `PR opened but auto-merge enqueue failed: ${
            mergeErr instanceof Error ? mergeErr.message : String(mergeErr)
          }`,
          autoMerge,
        };
      }
    }

    return url ? { url, autoMerge } : { skippedReason: "gh pr create produced no URL", autoMerge };
  } catch (err) {
    return {
      skippedReason: `gh pr create failed: ${err instanceof Error ? err.message : String(err)}`,
      autoMerge,
    };
  }
}
