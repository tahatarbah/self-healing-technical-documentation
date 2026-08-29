import { access, readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import fg from "fast-glob";
import type { ShtdConfig } from "@shtd/shared";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

export function repoRelative(repoPath: string, absPath: string): string {
  return toPosix(relative(repoPath, absPath));
}

/** Expand config globs under repoPath, applying ignore patterns. */
export async function expandGlobs(
  repoPath: string,
  patterns: string[],
  ignore: string[],
): Promise<string[]> {
  const found = await fg(patterns, {
    cwd: repoPath,
    absolute: true,
    onlyFiles: true,
    ignore,
    dot: false,
  });
  return found.map((p) => resolve(p));
}

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function listTsSourceFiles(
  repoPath: string,
  ignore: string[],
): Promise<string[]> {
  return expandGlobs(
    repoPath,
    ["**/*.{ts,tsx}", "!**/*.d.ts"],
    [...ignore, "**/node_modules/**", "**/dist/**", "**/.git/**"],
  );
}

export async function walkForMdxFallback(repoPath: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") {
          continue;
        }
        await walk(full);
      } else if (/\.mdx?$/i.test(e.name)) {
        out.push(full);
      }
    }
  }
  await walk(repoPath);
  return out;
}

export function matchesHealPath(
  relPath: string,
  healPaths: string[],
): boolean {
  const posix = toPosix(relPath);
  return healPaths.some((pattern) => {
    // Simple glob: ** / * support via fast-glob micromatch-style check
    return fg.isDynamicPattern(pattern)
      ? matchSimpleGlob(posix, pattern)
      : posix === pattern || posix.startsWith(pattern.replace(/\*\*$/, ""));
  });
}

function matchSimpleGlob(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`).test(path);
}

export function assertDocsOnlyPatchPath(
  relPath: string,
  config: ShtdConfig,
): void {
  if (!matchesHealPath(relPath, config.healPaths)) {
    throw new Error(
      `Patch path "${relPath}" is outside healPaths; docs-only patches allowed in v1.`,
    );
  }
}
