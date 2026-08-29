import type { ConfidenceLevel, HealFinding } from "@shtd/shared";

/**
 * Assign confidence based on finding kind and whether the patch is mechanical.
 * Rules: mechanical fixes (links, renames) → high; LLM rewrites → medium/low.
 */
export function scoreFinding(
  finding: HealFinding,
  opts?: { mechanical?: boolean; fromLlm?: boolean },
): ConfidenceLevel {
  if (opts?.mechanical) return "high";
  if (opts?.fromLlm) {
    // Prefer medium for LLM unless evidence is thin
    if (!finding.evidence.actual || !finding.evidence.expected) return "low";
    return "medium";
  }

  switch (finding.kind) {
    case "broken_link":
    case "broken_anchor":
    case "broken_image":
    case "openapi_mismatch":
    case "drift":
      return finding.patch ? "high" : finding.confidence;
    case "example_failure":
      return "medium";
    case "feedback":
      return "low";
    case "orphan_page":
      return "medium";
    default:
      return finding.confidence;
  }
}

export function applyScores(
  findings: HealFinding[],
  meta?: Map<string, { mechanical?: boolean; fromLlm?: boolean }>,
): HealFinding[] {
  return findings.map((f) => ({
    ...f,
    confidence: scoreFinding(f, meta?.get(f.id)),
  }));
}
