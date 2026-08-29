import { z } from "zod";

/** Confidence assigned to a proposed heal patch. */
export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/** Kind of documentation issue detected. */
export const FindingKindSchema = z.enum([
  "drift",
  "broken_link",
  "broken_anchor",
  "orphan_page",
  "broken_image",
  "openapi_mismatch",
  "example_failure",
  "feedback",
]);
export type FindingKind = z.infer<typeof FindingKindSchema>;

/** Lifecycle status of a finding. */
export const FindingStatusSchema = z.enum([
  "open",
  "proposed",
  "accepted",
  "rejected",
  "merged",
  "dismissed",
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

/** Evidence supporting a finding (symbol diff, link error, feedback quote, etc.). */
export const FindingEvidenceSchema = z.object({
  summary: z.string(),
  details: z.string().optional(),
  sourcePath: z.string().optional(),
  docPath: z.string().optional(),
  expected: z.string().optional(),
  actual: z.string().optional(),
  url: z.string().optional(),
});
export type FindingEvidence = z.infer<typeof FindingEvidenceSchema>;

/** A single heal finding with optional proposed patch. */
export const HealFindingSchema = z.object({
  id: z.string(),
  kind: FindingKindSchema,
  path: z.string(),
  evidence: FindingEvidenceSchema,
  patch: z.string().nullable().optional(),
  confidence: ConfidenceLevelSchema,
  status: FindingStatusSchema.default("open"),
  message: z.string().optional(),
});
export type HealFinding = z.infer<typeof HealFindingSchema>;

/** What triggered a scan/heal run. */
export const RunTriggerSchema = z.enum([
  "cli",
  "github_action",
  "schedule",
  "feedback",
  "manual",
]);
export type RunTrigger = z.infer<typeof RunTriggerSchema>;

export const RunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunStatsSchema = z.object({
  findingsTotal: z.number().int().nonnegative().default(0),
  findingsByKind: z.record(z.number().int().nonnegative()).default({}),
  findingsByConfidence: z
    .object({
      high: z.number().int().nonnegative().default(0),
      medium: z.number().int().nonnegative().default(0),
      low: z.number().int().nonnegative().default(0),
    })
    .default({ high: 0, medium: 0, low: 0 }),
  pagesScanned: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});
export type RunStats = z.infer<typeof RunStatsSchema>;

/** A scan or heal run. */
export const RunSchema = z.object({
  id: z.string(),
  trigger: RunTriggerSchema,
  status: RunStatusSchema,
  commitSha: z.string().optional(),
  repoPath: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  stats: RunStatsSchema.optional(),
  findings: z.array(HealFindingSchema).default([]),
  error: z.string().optional(),
});
export type Run = z.infer<typeof RunSchema>;

/** Auto-merge policy for high-confidence heals. */
export const AutoMergePolicySchema = z.object({
  enabled: z.boolean().default(false),
  /**
   * Only auto-merge findings at or above this confidence.
   * Product policy: keep at `high` — lower values open a PR instead.
   */
  minConfidence: ConfidenceLevelSchema.default("high"),
  /** When true, require green CI (or `SHTD_CI_STATUS=success` stub) before merge. */
  requireGreenCi: z.boolean().default(true),
});
export type AutoMergePolicy = z.infer<typeof AutoMergePolicySchema>;

/**
 * Cron-friendly schedule hint for Actions / external cron.
 * The Action package owns workflow YAML; this config is the shared source of truth.
 */
export const ScheduleConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Standard 5-field cron, e.g. `0 6 * * 1` (Mondays 06:00 UTC). */
  cron: z
    .string()
    .regex(
      /^(\S+\s+){4}\S+$/,
      "Expected a 5-field cron expression (e.g. \"0 6 * * 1\")",
    )
    .default("0 6 * * 1"),
  /** Optional human label shown in the dashboard. */
  description: z.string().optional(),
});
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;

/** Reader “this page is wrong” report (CLI, widget, or API). */
export const FeedbackInputSchema = z.object({
  page: z.string().min(1),
  note: z.string().min(1).max(4000),
  quote: z.string().max(2000).optional(),
  repoId: z.string().optional(),
  repoFullName: z.string().optional(),
});
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

/**
 * Shape of `shtd.config.json` at a repo root.
 * Controls docs globs, OpenAPI paths, ignore rules, and heal policy.
 */
export const ShtdConfigSchema = z.object({
  /** Glob patterns for documentation files to ingest. */
  docs: z
    .array(z.string().min(1, "docs glob must be non-empty"))
    .min(1, "docs must include at least one glob")
    .default(["docs/**/*.{md,mdx}", "**/*.md"]),
  /** Paths to OpenAPI specs (YAML/JSON). */
  openapi: z.array(z.string().min(1)).default([]),
  /** Glob patterns to ignore during ingest/detect. */
  ignore: z
    .array(z.string().min(1))
    .default(["**/node_modules/**", "**/.git/**"]),
  /**
   * Paths that may receive heal patches (docs-only in v1).
   * Default keeps patches under docs/ and Markdown files.
   */
  healPaths: z
    .array(z.string().min(1, "healPaths entry must be non-empty"))
    .min(1, "healPaths must include at least one pattern")
    .default(["docs/**", "**/*.md", "**/*.mdx"]),
  autoMerge: AutoMergePolicySchema.default({
    enabled: false,
    minConfidence: "high",
    requireGreenCi: true,
  }),
  /** Scheduled scan hint (cron / Action schedule). */
  schedule: ScheduleConfigSchema.default({
    enabled: false,
    cron: "0 6 * * 1",
  }),
  /** Optional label prefix for PRs (e.g. self-heal). */
  prLabels: z.array(z.string().min(1)).default(["self-heal"]),
  /** LLM provider hint; falls back to mock without ANTHROPIC_API_KEY. */
  llm: z
    .object({
      provider: z.enum(["anthropic", "openai", "mock"]).default("anthropic"),
      model: z.string().optional(),
    })
    .optional(),
});
export type ShtdConfig = z.infer<typeof ShtdConfigSchema>;

/** Default config used when no `shtd.config.json` is present. */
export const DEFAULT_SHTD_CONFIG: ShtdConfig = ShtdConfigSchema.parse({});

export const CONFIDENCE_LEVELS = ConfidenceLevelSchema.options;
export const FINDING_KINDS = FindingKindSchema.options;
