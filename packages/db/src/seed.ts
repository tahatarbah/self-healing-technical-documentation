import type {
  ConfidenceLevel,
  FindingEvidence,
  FindingKind,
  FindingStatus,
  RunStats,
  RunStatus,
  RunTrigger,
  ShtdConfig,
} from "@shtd/shared";

/** Stable demo IDs so the UI can deep-link without a live DB. */
export const SEED_IDS = {
  org: "org_demo",
  user: "user_demo",
  installation: "inst_demo",
  repo: "repo_demo",
  repoAlt: "repo_docs",
  run1: "run_001",
  run2: "run_002",
  run3: "run_003",
  finding1: "find_001",
  finding2: "find_002",
  finding3: "find_003",
  finding4: "find_004",
  finding5: "find_005",
  feedback1: "fb_001",
  feedback2: "fb_002",
  pr1: "pr_001",
} as const;

export type SeedOrganization = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

export type SeedUser = {
  id: string;
  githubId: string;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  organizationId: string | null;
  createdAt: Date;
};

export type SeedInstallation = {
  id: string;
  githubInstallationId: string;
  organizationId: string;
  accountLogin: string;
  createdAt: Date;
};

export type SeedRepo = {
  id: string;
  installationId: string | null;
  organizationId: string;
  githubRepoId: string;
  fullName: string;
  defaultBranch: string;
  config: Partial<ShtdConfig>;
  connected: boolean;
  createdAt: Date;
};

export type SeedRun = {
  id: string;
  repoId: string;
  trigger: RunTrigger;
  status: RunStatus;
  commitSha: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  stats: RunStats;
  error: string | null;
  createdAt: Date;
};

export type SeedFinding = {
  id: string;
  runId: string;
  repoId: string;
  kind: FindingKind;
  path: string;
  evidence: FindingEvidence;
  patch: string | null;
  confidence: ConfidenceLevel;
  status: FindingStatus;
  message: string | null;
  rejectNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SeedFeedback = {
  id: string;
  repoId: string;
  page: string;
  quote: string | null;
  note: string;
  userAgent: string | null;
  findingId: string | null;
  status: string;
  createdAt: Date;
};

export type SeedPrLink = {
  id: string;
  runId: string;
  url: string;
  number: number;
  mergeState: string;
  createdAt: Date;
};

export type SeedData = {
  organizations: SeedOrganization[];
  users: SeedUser[];
  installations: SeedInstallation[];
  repos: SeedRepo[];
  runs: SeedRun[];
  findings: SeedFinding[];
  feedback: SeedFeedback[];
  prLinks: SeedPrLink[];
};

const now = new Date("2026-08-27T10:00:00.000Z");
const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

/** In-memory demo dataset used when Postgres / GitHub are not configured. */
export function createSeedData(): SeedData {
  return {
    organizations: [
      {
        id: SEED_IDS.org,
        name: "Acme Docs",
        slug: "acme-docs",
        createdAt: twoDaysAgo,
      },
    ],
    users: [
      {
        id: SEED_IDS.user,
        githubId: "10001",
        login: "demo-user",
        name: "Demo User",
        email: "demo@example.com",
        avatarUrl: null,
        organizationId: SEED_IDS.org,
        createdAt: twoDaysAgo,
      },
    ],
    installations: [
      {
        id: SEED_IDS.installation,
        githubInstallationId: "90001",
        organizationId: SEED_IDS.org,
        accountLogin: "acme-docs",
        createdAt: twoDaysAgo,
      },
    ],
    repos: [
      {
        id: SEED_IDS.repo,
        installationId: SEED_IDS.installation,
        organizationId: SEED_IDS.org,
        githubRepoId: "20001",
        fullName: "acme-docs/sample-api",
        defaultBranch: "main",
        config: {
          docs: ["docs/**/*.{md,mdx}"],
          openapi: ["openapi/openapi.yaml"],
          autoMerge: { enabled: false, minConfidence: "high", requireGreenCi: true },
          schedule: { enabled: true, cron: "0 6 * * 1", description: "Weekly Monday scan" },
        },
        connected: true,
        createdAt: twoDaysAgo,
      },
      {
        id: SEED_IDS.repoAlt,
        installationId: SEED_IDS.installation,
        organizationId: SEED_IDS.org,
        githubRepoId: "20002",
        fullName: "acme-docs/product-docs",
        defaultBranch: "main",
        config: {
          docs: ["**/*.md"],
          autoMerge: { enabled: true, minConfidence: "high", requireGreenCi: true },
          schedule: { enabled: false, cron: "0 6 * * 1" },
        },
        connected: true,
        createdAt: dayAgo,
      },
    ],
    runs: [
      {
        id: SEED_IDS.run1,
        repoId: SEED_IDS.repo,
        trigger: "github_action",
        status: "completed",
        commitSha: "a1b2c3d4e5f6789012345678abcdef01",
        startedAt: hourAgo,
        finishedAt: new Date(hourAgo.getTime() + 42_000),
        stats: {
          findingsTotal: 3,
          findingsByKind: { drift: 1, broken_link: 1, openapi_mismatch: 1 },
          findingsByConfidence: { high: 1, medium: 1, low: 1 },
          pagesScanned: 12,
          durationMs: 42_000,
        },
        error: null,
        createdAt: hourAgo,
      },
      {
        id: SEED_IDS.run2,
        repoId: SEED_IDS.repo,
        trigger: "schedule",
        status: "completed",
        commitSha: "b2c3d4e5f6789012345678abcdef0123",
        startedAt: dayAgo,
        finishedAt: new Date(dayAgo.getTime() + 38_000),
        stats: {
          findingsTotal: 1,
          findingsByKind: { broken_anchor: 1 },
          findingsByConfidence: { high: 1, medium: 0, low: 0 },
          pagesScanned: 12,
          durationMs: 38_000,
        },
        error: null,
        createdAt: dayAgo,
      },
      {
        id: SEED_IDS.run3,
        repoId: SEED_IDS.repoAlt,
        trigger: "feedback",
        status: "completed",
        commitSha: "c3d4e5f6789012345678abcdef012345",
        startedAt: dayAgo,
        finishedAt: new Date(dayAgo.getTime() + 55_000),
        stats: {
          findingsTotal: 1,
          findingsByKind: { feedback: 1 },
          findingsByConfidence: { high: 0, medium: 1, low: 0 },
          pagesScanned: 8,
          durationMs: 55_000,
        },
        error: null,
        createdAt: dayAgo,
      },
    ],
    findings: [
      {
        id: SEED_IDS.finding1,
        runId: SEED_IDS.run1,
        repoId: SEED_IDS.repo,
        kind: "drift",
        path: "docs/api.md",
        evidence: {
          summary: "Documented signature for `createWidget` no longer matches source.",
          sourcePath: "src/widgets.ts",
          docPath: "docs/api.md",
          expected: "createWidget(name: string, opts?: Options)",
          actual: "createWidget(name: string, opts: Options)",
        },
        patch: `--- a/docs/api.md
+++ b/docs/api.md
@@ -14,7 +14,7 @@
-\`createWidget(name: string, opts?: Options)\`
+\`createWidget(name: string, opts: Options)\`
`,
        confidence: "high",
        status: "proposed",
        message: "Opts parameter is now required.",
        rejectNote: null,
        createdAt: hourAgo,
        updatedAt: hourAgo,
      },
      {
        id: SEED_IDS.finding2,
        runId: SEED_IDS.run1,
        repoId: SEED_IDS.repo,
        kind: "broken_link",
        path: "docs/getting-started.md",
        evidence: {
          summary: "Relative link target missing.",
          docPath: "docs/getting-started.md",
          url: "./legacy-setup.md",
          details: "File docs/legacy-setup.md does not exist.",
        },
        patch: `--- a/docs/getting-started.md
+++ b/docs/getting-started.md
@@ -22,7 +22,7 @@
-[Legacy setup](./legacy-setup.md)
+[Setup](./getting-started.md#setup)
`,
        confidence: "medium",
        status: "proposed",
        message: "Retarget broken relative link.",
        rejectNote: null,
        createdAt: hourAgo,
        updatedAt: hourAgo,
      },
      {
        id: SEED_IDS.finding3,
        runId: SEED_IDS.run1,
        repoId: SEED_IDS.repo,
        kind: "openapi_mismatch",
        path: "docs/openapi.md",
        evidence: {
          summary: "Docs reference operationId `listWidgets` which was removed from the spec.",
          sourcePath: "openapi/openapi.yaml",
          docPath: "docs/openapi.md",
          expected: "listWidgets",
          actual: "(removed)",
        },
        patch: null,
        confidence: "low",
        status: "open",
        message: "Needs human rewrite of OpenAPI section.",
        rejectNote: null,
        createdAt: hourAgo,
        updatedAt: hourAgo,
      },
      {
        id: SEED_IDS.finding4,
        runId: SEED_IDS.run2,
        repoId: SEED_IDS.repo,
        kind: "broken_anchor",
        path: "docs/api.md",
        evidence: {
          summary: "Anchor #rate-limits not found on page.",
          docPath: "docs/api.md",
          url: "#rate-limits",
        },
        patch: `--- a/docs/api.md
+++ b/docs/api.md
@@ -40,6 +40,8 @@
+## Rate limits
+Requests are limited to 100/min per API key.
`,
        confidence: "high",
        status: "accepted",
        message: "Restored missing section heading.",
        rejectNote: null,
        createdAt: dayAgo,
        updatedAt: dayAgo,
      },
      {
        id: SEED_IDS.finding5,
        runId: SEED_IDS.run3,
        repoId: SEED_IDS.repoAlt,
        kind: "feedback",
        path: "docs/getting-started.md",
        evidence: {
          summary: "Reader reported inaccurate install command.",
          docPath: "docs/getting-started.md",
          details: "Says npm but project uses pnpm.",
        },
        patch: `--- a/docs/getting-started.md
+++ b/docs/getting-started.md
@@ -8,7 +8,7 @@
-npm install
+pnpm install
`,
        confidence: "medium",
        status: "proposed",
        message: "Align install docs with packageManager.",
        rejectNote: null,
        createdAt: dayAgo,
        updatedAt: dayAgo,
      },
    ],
    feedback: [
      {
        id: SEED_IDS.feedback1,
        repoId: SEED_IDS.repoAlt,
        page: "docs/getting-started.md",
        quote: "npm install",
        note: "We use pnpm, not npm — this confused new contributors.",
        userAgent: "Mozilla/5.0 (demo)",
        findingId: SEED_IDS.finding5,
        status: "linked",
        createdAt: dayAgo,
      },
      {
        id: SEED_IDS.feedback2,
        repoId: SEED_IDS.repo,
        page: "docs/api.md",
        quote: "Widgets are eventually consistent",
        note: "This is no longer true after the sync rewrite.",
        userAgent: "Mozilla/5.0 (demo)",
        findingId: null,
        status: "open",
        createdAt: hourAgo,
      },
    ],
    prLinks: [
      {
        id: SEED_IDS.pr1,
        runId: SEED_IDS.run1,
        url: "https://github.com/acme-docs/sample-api/pull/42",
        number: 42,
        mergeState: "open",
        createdAt: hourAgo,
      },
    ],
  };
}
