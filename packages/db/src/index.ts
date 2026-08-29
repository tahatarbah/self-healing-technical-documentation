/**
 * @shtd/db — Drizzle schema, Postgres client, and demo seed data.
 */
export {
  organizations,
  users,
  installations,
  repos,
  runs,
  findings,
  feedback,
  prLinks,
  schema,
  organizationsRelations,
  usersRelations,
  installationsRelations,
  reposRelations,
  runsRelations,
  findingsRelations,
  feedbackRelations,
  prLinksRelations,
  type Organization,
  type User,
  type Installation,
  type Repo,
  type RunRow,
  type FindingRow,
  type FeedbackRow,
  type PrLink,
} from "./schema.js";

export { createDb, closeDb, hasDatabaseUrl, type Db } from "./client.js";

export {
  createSeedData,
  SEED_IDS,
  type SeedData,
  type SeedOrganization,
  type SeedUser,
  type SeedInstallation,
  type SeedRepo,
  type SeedRun,
  type SeedFinding,
  type SeedFeedback,
  type SeedPrLink,
} from "./seed.js";

export const DB_PACKAGE_NAME = "@shtd/db" as const;
