import {
  createSeedData,
  hasDatabaseUrl,
  type SeedData,
  type SeedFeedback,
  type SeedFinding,
  type SeedPrLink,
  type SeedRepo,
  type SeedRun,
} from "@shtd/db";
import type { FindingStatus } from "@shtd/shared";
import { randomUUID } from "node:crypto";

/**
 * Application data access.
 * Uses in-memory seed when DATABASE_URL is unset (demo mode).
 * Postgres path is wired for later; seed store keeps the UI demoable today.
 */

type Store = SeedData;

declare global {
  // eslint-disable-next-line no-var
  var __shtdStore: Store | undefined;
}

function store(): Store {
  if (!globalThis.__shtdStore) {
    globalThis.__shtdStore = createSeedData();
  }
  return globalThis.__shtdStore;
}

export function usingDemoStore(): boolean {
  return !hasDatabaseUrl();
}

export async function listRepos(): Promise<SeedRepo[]> {
  return [...store().repos].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function getRepo(id: string): Promise<SeedRepo | undefined> {
  return store().repos.find((r) => r.id === id);
}

export async function connectRepo(input: {
  fullName: string;
  defaultBranch?: string;
}): Promise<SeedRepo> {
  const s = store();
  const org = s.organizations[0];
  if (!org) throw new Error("No organization");
  const installation = s.installations[0] ?? null;
  const repo: SeedRepo = {
    id: `repo_${randomUUID().slice(0, 8)}`,
    installationId: installation?.id ?? null,
    organizationId: org.id,
    githubRepoId: String(Date.now()),
    fullName: input.fullName,
    defaultBranch: input.defaultBranch ?? "main",
    config: {
      docs: ["docs/**/*.{md,mdx}"],
      autoMerge: { enabled: false, minConfidence: "high", requireGreenCi: true },
      schedule: { enabled: false, cron: "0 6 * * 1" },
    },
    connected: true,
    createdAt: new Date(),
  };
  s.repos.push(repo);
  return repo;
}

export type RepoConfigPatch = {
  docs?: string[];
  ignore?: string[];
  openapi?: string[];
  healPaths?: string[];
  prLabels?: string[];
  autoMerge?: {
    enabled?: boolean;
    minConfidence?: "high" | "medium" | "low";
    requireGreenCi?: boolean;
  };
  schedule?: {
    enabled?: boolean;
    cron?: string;
    description?: string;
  };
};

export async function updateRepo(
  id: string,
  patch: {
    connected?: boolean;
    defaultBranch?: string;
    config?: RepoConfigPatch;
  },
): Promise<SeedRepo | undefined> {
  const repo = store().repos.find((r) => r.id === id);
  if (!repo) return undefined;
  if (patch.connected !== undefined) repo.connected = patch.connected;
  if (patch.defaultBranch !== undefined) repo.defaultBranch = patch.defaultBranch;
  if (patch.config !== undefined) {
    const next = { ...repo.config };
    if (patch.config.docs) next.docs = patch.config.docs;
    if (patch.config.ignore) next.ignore = patch.config.ignore;
    if (patch.config.openapi) next.openapi = patch.config.openapi;
    if (patch.config.healPaths) next.healPaths = patch.config.healPaths;
    if (patch.config.prLabels) next.prLabels = patch.config.prLabels;
    if (patch.config.autoMerge) {
      next.autoMerge = {
        enabled: patch.config.autoMerge.enabled ?? next.autoMerge?.enabled ?? false,
        minConfidence:
          patch.config.autoMerge.minConfidence ?? next.autoMerge?.minConfidence ?? "high",
        requireGreenCi:
          patch.config.autoMerge.requireGreenCi ?? next.autoMerge?.requireGreenCi ?? true,
      };
    }
    if (patch.config.schedule) {
      next.schedule = {
        enabled: patch.config.schedule.enabled ?? next.schedule?.enabled ?? false,
        cron: patch.config.schedule.cron ?? next.schedule?.cron ?? "0 6 * * 1",
        description:
          patch.config.schedule.description ?? next.schedule?.description,
      };
    }
    repo.config = next;
  }
  return repo;
}

export async function listRuns(repoId?: string): Promise<(SeedRun & { repoFullName: string })[]> {
  const s = store();
  const repoMap = new Map(s.repos.map((r) => [r.id, r.fullName]));
  return s.runs
    .filter((r) => (repoId ? r.repoId === repoId : true))
    .map((r) => ({ ...r, repoFullName: repoMap.get(r.repoId) ?? "unknown" }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getRun(
  id: string,
): Promise<(SeedRun & { repoFullName: string; findings: SeedFinding[]; prLinks: SeedPrLink[] }) | undefined> {
  const s = store();
  const run = s.runs.find((r) => r.id === id);
  if (!run) return undefined;
  const repo = s.repos.find((r) => r.id === run.repoId);
  return {
    ...run,
    repoFullName: repo?.fullName ?? "unknown",
    findings: s.findings.filter((f) => f.runId === id),
    prLinks: s.prLinks.filter((p) => p.runId === id),
  };
}

export type FindingFilters = {
  kind?: string;
  confidence?: string;
  status?: string;
  repoId?: string;
  reviewQueue?: boolean;
};

export async function listFindings(
  filters: FindingFilters = {},
): Promise<(SeedFinding & { repoFullName: string })[]> {
  const s = store();
  const repoMap = new Map(s.repos.map((r) => [r.id, r.fullName]));
  return s.findings
    .filter((f) => {
      if (filters.repoId && f.repoId !== filters.repoId) return false;
      if (filters.kind && f.kind !== filters.kind) return false;
      if (filters.confidence && f.confidence !== filters.confidence) return false;
      if (filters.status && f.status !== filters.status) return false;
      if (filters.reviewQueue && !["open", "proposed"].includes(f.status)) return false;
      return true;
    })
    .map((f) => ({ ...f, repoFullName: repoMap.get(f.repoId) ?? "unknown" }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getFinding(
  id: string,
): Promise<(SeedFinding & { repoFullName: string }) | undefined> {
  const s = store();
  const finding = s.findings.find((f) => f.id === id);
  if (!finding) return undefined;
  const repo = s.repos.find((r) => r.id === finding.repoId);
  return { ...finding, repoFullName: repo?.fullName ?? "unknown" };
}

export async function reviewFinding(
  id: string,
  action: "accept" | "reject",
  rejectNote?: string,
): Promise<SeedFinding | undefined> {
  const finding = store().findings.find((f) => f.id === id);
  if (!finding) return undefined;
  const next: FindingStatus = action === "accept" ? "accepted" : "rejected";
  finding.status = next;
  finding.updatedAt = new Date();
  if (action === "reject") {
    finding.rejectNote = rejectNote?.trim() || "Rejected by reviewer";
  }
  return finding;
}

export async function listFeedback(): Promise<(SeedFeedback & { repoFullName: string })[]> {
  const s = store();
  const repoMap = new Map(s.repos.map((r) => [r.id, r.fullName]));
  return s.feedback
    .map((f) => ({ ...f, repoFullName: repoMap.get(f.repoId) ?? "unknown" }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createFeedback(input: {
  repoId?: string;
  repoFullName?: string;
  page: string;
  quote?: string;
  note: string;
  userAgent?: string;
}): Promise<SeedFeedback & { finding: SeedFinding }> {
  const s = store();
  let repo = input.repoId
    ? s.repos.find((r) => r.id === input.repoId)
    : undefined;
  if (!repo && input.repoFullName) {
    repo = s.repos.find(
      (r) => r.fullName.toLowerCase() === input.repoFullName!.toLowerCase(),
    );
  }
  if (!repo && s.repos.length === 1) {
    repo = s.repos[0];
  }
  if (!repo) throw new Error("Repo not found — pass repoId or repoFullName");

  const now = new Date();
  const findingId = `find_${randomUUID().slice(0, 8)}`;
  const runId = `run_fb_${randomUUID().slice(0, 6)}`;

  const run: SeedRun = {
    id: runId,
    repoId: repo.id,
    trigger: "feedback",
    status: "completed",
    commitSha: null,
    startedAt: now,
    finishedAt: now,
    stats: {
      findingsTotal: 1,
      findingsByKind: { feedback: 1 },
      findingsByConfidence: { high: 0, medium: 0, low: 1 },
    },
    error: null,
    createdAt: now,
  };

  const finding: SeedFinding = {
    id: findingId,
    runId,
    repoId: repo.id,
    kind: "feedback",
    path: input.page,
    evidence: {
      summary: "Reader reported an inaccuracy",
      docPath: input.page,
      details: input.note,
      expected: input.quote,
    },
    patch: null,
    confidence: "low",
    status: "open",
    message: input.quote
      ? `Reader feedback on "${input.quote.slice(0, 80)}": ${input.note}`
      : `Reader feedback: ${input.note}`,
    rejectNote: null,
    createdAt: now,
    updatedAt: now,
  };

  const row: SeedFeedback = {
    id: `fb_${randomUUID().slice(0, 8)}`,
    repoId: repo.id,
    page: input.page,
    quote: input.quote ?? null,
    note: input.note,
    userAgent: input.userAgent ?? null,
    findingId,
    status: "linked",
    createdAt: now,
  };

  s.runs.unshift(run);
  s.findings.unshift(finding);
  s.feedback.unshift(row);
  return { ...row, finding };
}

export async function getSettings() {
  const s = store();
  const org = s.organizations[0];
  const repos = s.repos;
  return {
    mode: usingDemoStore() ? ("demo" as const) : ("postgres" as const),
    organization: org ?? null,
    githubOAuth: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    defaults: {
      docs: ["docs/**/*.{md,mdx}"],
      autoMerge: { enabled: false, minConfidence: "high" as const, requireGreenCi: true },
      ignore: ["**/node_modules/**", "**/.git/**"],
    },
    repos: repos.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      config: r.config,
      connected: r.connected,
    })),
  };
}

export async function overviewStats() {
  const [runs, findings, feedback, repos] = await Promise.all([
    listRuns(),
    listFindings(),
    listFeedback(),
    listRepos(),
  ]);
  const reviewOpen = findings.filter((f) => ["open", "proposed"].includes(f.status)).length;
  return {
    repos: repos.filter((r) => r.connected).length,
    runs: runs.length,
    findings: findings.length,
    reviewOpen,
    feedbackOpen: feedback.filter((f) => f.status === "open").length,
    latestRuns: runs.slice(0, 5),
  };
}
