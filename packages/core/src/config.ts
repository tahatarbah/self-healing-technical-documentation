import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_SHTD_CONFIG,
  ShtdConfigSchema,
  type ShtdConfig,
} from "@shtd/shared";

const CONFIG_FILENAME = "shtd.config.json";

type ConfigIssue = { path: (string | number)[]; message: string };

/** Format schema issues into a human-readable bullet list. */
export function formatConfigValidationError(err: {
  issues: ConfigIssue[];
}): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

/** Load and validate `shtd.config.json` from a repo root (or defaults). */
export async function loadConfig(repoPath: string): Promise<ShtdConfig> {
  const configPath = join(repoPath, CONFIG_FILENAME);
  try {
    const raw = await readFile(configPath, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(
          `Invalid JSON in ${CONFIG_FILENAME}: ${err.message}\n` +
            `Fix the file at ${configPath} or delete it to use defaults.`,
        );
      }
      throw err;
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        `Invalid ${CONFIG_FILENAME}: expected a JSON object at ${configPath}`,
      );
    }

    const result = ShtdConfigSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Invalid ${CONFIG_FILENAME} at ${configPath}:\n` +
          `${formatConfigValidationError(result.error)}\n` +
          `See docs/cli.md for the supported schema (docs, openapi, healPaths, autoMerge, schedule).`,
      );
    }
    return result.data;
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : undefined;
    if (code === "ENOENT") {
      return { ...DEFAULT_SHTD_CONFIG };
    }
    throw err;
  }
}

export { CONFIG_FILENAME };
