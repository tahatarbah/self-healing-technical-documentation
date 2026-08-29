import type { HealFinding } from "@shtd/shared";

export interface PatchProposal {
  findingId: string;
  /** Repo-relative docs path */
  path: string;
  /** Unified diff */
  patch: string;
  /** Full file content after edit, when available */
  newContent?: string;
  rationale: string;
  mechanical: boolean;
  fromLlm: boolean;
}

export interface LlmProvider {
  readonly name: string;
  /** Whether the provider can make remote calls. */
  isAvailable(): boolean;
  /**
   * Propose a docs-only patch for a finding.
   * Returns null if the provider cannot help.
   */
  proposePatch(input: {
    finding: HealFinding;
    docContent: string;
    sourceSnippet?: string;
  }): Promise<PatchProposal | null>;
}

export type ProviderName = "anthropic" | "mock";

export function resolveProviderName(
  configHint?: string,
): ProviderName {
  const fromEnv = process.env.SHTD_LLM_PROVIDER?.toLowerCase();
  const name = (fromEnv ?? configHint ?? "anthropic").toLowerCase();
  if (name === "mock") return "mock";
  return "anthropic";
}
