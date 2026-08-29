import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: { sql: ReturnType<typeof postgres>; db: Db } | null = null;

/**
 * Create (or reuse) a Drizzle client against Postgres.
 * Pass `DATABASE_URL` or an explicit connection string.
 */
export function createDb(connectionString?: string): Db {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Configure Postgres or use the web app demo store.",
    );
  }

  if (cached && connectionString === undefined) {
    return cached.db;
  }

  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema });

  if (connectionString === undefined) {
    cached = { sql, db };
  }

  return db;
}

/** Close the cached connection (tests / graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.sql.end({ timeout: 5 });
    cached = null;
  }
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
