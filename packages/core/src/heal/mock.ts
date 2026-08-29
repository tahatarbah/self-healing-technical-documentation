import type { LlmProvider, PatchProposal } from "./provider.js";

/**
 * Offline / no-API-key provider.
 * `isAvailable()` is always false so the heal loop skips remote calls;
 * mechanical patches in `generatePatches` still run.
 * Force via `SHTD_LLM_PROVIDER=mock` or missing `ANTHROPIC_API_KEY`.
 */
export class MockProvider implements LlmProvider {
  readonly name = "mock";

  isAvailable(): boolean {
    return false;
  }

  async proposePatch(): Promise<PatchProposal | null> {
    return null;
  }
}
