import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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

/** Organization that owns installations and repos. */
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Dashboard user (GitHub OAuth identity). */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    githubId: text("github_id").notNull(),
    login: text("login").notNull(),
    name: text("name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_github_id_uidx").on(t.githubId)],
);

/** GitHub App installation linked to an organization. */
export const installations = pgTable(
  "installations",
  {
    id: text("id").primaryKey(),
    githubInstallationId: text("github_installation_id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountLogin: text("account_login").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("installations_github_id_uidx").on(t.githubInstallationId)],
);

/** Connected repository with optional SHTD config overlay. */
export const repos = pgTable(
  "repos",
  {
    id: text("id").primaryKey(),
    installationId: text("installation_id").references(() => installations.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    githubRepoId: text("github_repo_id").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    config: jsonb("config").$type<Partial<ShtdConfig>>().notNull().default({}),
    connected: boolean("connected").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("repos_github_repo_id_uidx").on(t.githubRepoId)],
);

/** Scan or heal run for a repo. */
export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  repoId: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  trigger: text("trigger").$type<RunTrigger>().notNull(),
  status: text("status").$type<RunStatus>().notNull().default("pending"),
  commitSha: text("commit_sha"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  stats: jsonb("stats").$type<RunStats>().notNull().default({
    findingsTotal: 0,
    findingsByKind: {},
    findingsByConfidence: { high: 0, medium: 0, low: 0 },
  }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Individual heal finding within a run. */
export const findings = pgTable("findings", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  repoId: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  kind: text("kind").$type<FindingKind>().notNull(),
  path: text("path").notNull(),
  evidence: jsonb("evidence").$type<FindingEvidence>().notNull(),
  patch: text("patch"),
  confidence: text("confidence").$type<ConfidenceLevel>().notNull(),
  status: text("status").$type<FindingStatus>().notNull().default("open"),
  message: text("message"),
  /** Populated when a reviewer rejects — trains “don’t do this” notes. */
  rejectNote: text("reject_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Reader “this page is wrong” reports. */
export const feedback = pgTable("feedback", {
  id: text("id").primaryKey(),
  repoId: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  page: text("page").notNull(),
  quote: text("quote"),
  note: text("note").notNull(),
  userAgent: text("user_agent"),
  findingId: text("finding_id").references(() => findings.id, { onDelete: "set null" }),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** GitHub PR opened for a heal run. */
export const prLinks = pgTable("pr_links", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  number: integer("number").notNull(),
  mergeState: text("merge_state").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  installations: many(installations),
  repos: many(repos),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const installationsRelations = relations(installations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [installations.organizationId],
    references: [organizations.id],
  }),
  repos: many(repos),
}));

export const reposRelations = relations(repos, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [repos.organizationId],
    references: [organizations.id],
  }),
  installation: one(installations, {
    fields: [repos.installationId],
    references: [installations.id],
  }),
  runs: many(runs),
  findings: many(findings),
  feedback: many(feedback),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  repo: one(repos, {
    fields: [runs.repoId],
    references: [repos.id],
  }),
  findings: many(findings),
  prLinks: many(prLinks),
}));

export const findingsRelations = relations(findings, ({ one, many }) => ({
  run: one(runs, {
    fields: [findings.runId],
    references: [runs.id],
  }),
  repo: one(repos, {
    fields: [findings.repoId],
    references: [repos.id],
  }),
  feedback: many(feedback),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  repo: one(repos, {
    fields: [feedback.repoId],
    references: [repos.id],
  }),
  finding: one(findings, {
    fields: [feedback.findingId],
    references: [findings.id],
  }),
}));

export const prLinksRelations = relations(prLinks, ({ one }) => ({
  run: one(runs, {
    fields: [prLinks.runId],
    references: [runs.id],
  }),
}));

export const schema = {
  organizations,
  users,
  installations,
  repos,
  runs,
  findings,
  feedback,
  prLinks,
};

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Installation = typeof installations.$inferSelect;
export type Repo = typeof repos.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type FindingRow = typeof findings.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;
export type PrLink = typeof prLinks.$inferSelect;
