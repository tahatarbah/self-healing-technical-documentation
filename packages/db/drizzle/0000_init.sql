CREATE TABLE IF NOT EXISTS "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "github_id" text NOT NULL,
  "login" text NOT NULL,
  "name" text,
  "email" text,
  "avatar_url" text,
  "organization_id" text REFERENCES "organizations"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_github_id_uidx" ON "users" ("github_id");

CREATE TABLE IF NOT EXISTS "installations" (
  "id" text PRIMARY KEY NOT NULL,
  "github_installation_id" text NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "account_login" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "installations_github_id_uidx" ON "installations" ("github_installation_id");

CREATE TABLE IF NOT EXISTS "repos" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text REFERENCES "installations"("id") ON DELETE set null,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "github_repo_id" text NOT NULL,
  "full_name" text NOT NULL,
  "default_branch" text DEFAULT 'main' NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "connected" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "repos_github_repo_id_uidx" ON "repos" ("github_repo_id");

CREATE TABLE IF NOT EXISTS "runs" (
  "id" text PRIMARY KEY NOT NULL,
  "repo_id" text NOT NULL REFERENCES "repos"("id") ON DELETE cascade,
  "trigger" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "commit_sha" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "stats" jsonb DEFAULT '{"findingsTotal":0,"findingsByKind":{},"findingsByConfidence":{"high":0,"medium":0,"low":0}}'::jsonb NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "findings" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "runs"("id") ON DELETE cascade,
  "repo_id" text NOT NULL REFERENCES "repos"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "path" text NOT NULL,
  "evidence" jsonb NOT NULL,
  "patch" text,
  "confidence" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "message" text,
  "reject_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "repo_id" text NOT NULL REFERENCES "repos"("id") ON DELETE cascade,
  "page" text NOT NULL,
  "quote" text,
  "note" text NOT NULL,
  "user_agent" text,
  "finding_id" text REFERENCES "findings"("id") ON DELETE set null,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pr_links" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "runs"("id") ON DELETE cascade,
  "url" text NOT NULL,
  "number" integer NOT NULL,
  "merge_state" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
