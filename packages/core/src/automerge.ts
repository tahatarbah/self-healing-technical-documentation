import type { ConfidenceLevel, HealFinding, ShtdConfig } from "@shtd/shared";

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export interface AutoMergeDecision {
  /** Whether the run is eligible to auto-merge under config + confidence. */
  eligible: boolean;
  /** Human-readable explanation (always set). */
  reason: string;
  /** Patched findings that meet the confidence floor. */
  highConfidenceCount: number;
  /** Patched findings below the floor (block auto-merge). */
  belowThresholdCount: number;
  /** CI gate result when requireGreenCi is on. */
  ciStatus: "success" | "unknown" | "skipped";
}

function meetsMin(
  confidence: ConfidenceLevel,
  min: ConfidenceLevel,
): boolean {
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[min];
}

/**
 * Product policy: auto-merge only when enabled, patched findings meet
 * `minConfidence` (default `high`), and CI is green when required.
 *
 * CI green is stubbed via env `SHTD_CI_STATUS=success` until Checks API lands.
 * Without that env (and when requireGreenCi), eligibility is blocked.
 */
export function evaluateAutoMergePolicy(
  findings: HealFinding[],
  config: ShtdConfig,
  opts?: { ciStatusEnv?: string | undefined },
): AutoMergeDecision {
  const policy = config.autoMerge;
  const patched = findings.filter((f) => Boolean(f.patch));

  if (!policy.enabled) {
    return {
      eligible: false,
      reason:
        "Auto-merge disabled in config — open a PR for human review (set autoMerge.enabled).",
      highConfidenceCount: 0,
      belowThresholdCount: patched.length,
      ciStatus: "skipped",
    };
  }

  if (patched.length === 0) {
    return {
      eligible: false,
      reason: "No patched findings to auto-merge.",
      highConfidenceCount: 0,
      belowThresholdCount: 0,
      ciStatus: "skipped",
    };
  }

  // Product lock: never auto-merge below high even if config is mis-set.
  const floor: ConfidenceLevel =
    CONFIDENCE_RANK[policy.minConfidence] < CONFIDENCE_RANK.high
      ? "high"
      : policy.minConfidence;

  const high = patched.filter((f) => meetsMin(f.confidence, floor));
  const below = patched.filter((f) => !meetsMin(f.confidence, floor));

  if (below.length > 0) {
    return {
      eligible: false,
      reason: `${below.length} patched finding(s) below ${floor} confidence — open PR for review instead of auto-merge.`,
      highConfidenceCount: high.length,
      belowThresholdCount: below.length,
      ciStatus: "skipped",
    };
  }

  let ciStatus: AutoMergeDecision["ciStatus"] = "skipped";
  if (policy.requireGreenCi) {
    const env =
      opts?.ciStatusEnv ??
      process.env.SHTD_CI_STATUS ??
      process.env.SHTD_CI_GREEN;
    if (env === "success" || env === "1" || env === "true") {
      ciStatus = "success";
    } else {
      ciStatus = "unknown";
      return {
        eligible: false,
        reason:
          "CI green required but status unknown — stub with SHTD_CI_STATUS=success (Checks API not wired yet). Opening PR instead.",
        highConfidenceCount: high.length,
        belowThresholdCount: 0,
        ciStatus,
      };
    }
  }

  return {
    eligible: true,
    reason: `All ${high.length} patched finding(s) meet ${floor} confidence${
      policy.requireGreenCi ? " and CI is green (stub)" : ""
    } — eligible for auto-merge.`,
    highConfidenceCount: high.length,
    belowThresholdCount: 0,
    ciStatus,
  };
}
