/**
 * @shtd/core — Self-healing technical documentation engine.
 *
 * Ingest (MD/MDX, OpenAPI, TS symbols) → Doc Graph → detectors →
 * patch generator (mechanical + Anthropic) → confidence scoring.
 */
export type {
  HealFinding,
  Run,
  ShtdConfig,
  ConfidenceLevel,
  FindingKind,
} from "@shtd/shared";

export { loadConfig, CONFIG_FILENAME, formatConfigValidationError } from "./config.js";
export { ingestRepo, type RepoIndex, type DocPage } from "./ingest/index.js";
export { buildDocGraph, summarizeGraph, type DocGraph } from "./ingest/graph.js";
export {
  runDetectors,
  aggregateFindings,
  detectDrift,
  detectBrokenLinks,
  detectOpenApiMismatch,
  detectExampleFailures,
} from "./detect/index.js";
export {
  generatePatches,
  createLlmProvider,
  constrainPatchesToDocs,
  scoreFinding,
  applyScores,
  AnthropicProvider,
  MockProvider,
  type LlmProvider,
  type PatchProposal,
  type FilePatch,
} from "./heal/index.js";
export {
  scan,
  heal,
  type ScanOptions,
  type ScanResult,
  type HealOptions,
  type HealResult,
} from "./pipeline.js";
export {
  toScanReport,
  formatHumanSummary,
  formatFindingLine,
  type ScanReport,
} from "./report.js";
export {
  addLocalFeedback,
  loadLocalFeedback,
  findingsFromFeedback,
  FEEDBACK_REL_PATH,
  type LocalFeedbackItem,
} from "./feedback.js";
export {
  evaluateAutoMergePolicy,
  type AutoMergeDecision,
} from "./automerge.js";
export { validateTsExample } from "./detect/examples.js";

export const CORE_PACKAGE_NAME = "@shtd/core" as const;
