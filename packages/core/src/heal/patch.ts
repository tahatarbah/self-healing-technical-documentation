import type { HealFinding, ShtdConfig } from "@shtd/shared";
import { assertDocsOnlyPatchPath, matchesHealPath } from "../util/fs.js";

export interface FilePatch {
  /** Repo-relative path (docs only). */
  path: string;
  /** Unified diff or full replacement hint. */
  unifiedDiff: string;
  /** Optional full new content when applying locally. */
  newContent?: string;
  findingIds: string[];
}

export interface TextReplacement {
  from: string;
  to: string;
  /** When true, replace identifier tokens only (`\b…\b`). */
  wholeWord?: boolean;
}

/** Ensure every patch path is within config.healPaths. */
export function constrainPatchesToDocs(
  patches: FilePatch[],
  config: ShtdConfig,
): FilePatch[] {
  const allowed: FilePatch[] = [];
  for (const p of patches) {
    const posix = p.path.replace(/\\/g, "/");
    if (!posix || posix.includes("..") || posix.startsWith("/")) {
      continue;
    }
    if (!matchesHealPath(posix, config.healPaths)) {
      continue;
    }
    // Reject obvious non-doc extensions even if a loose healPaths glob matched.
    if (!isLikelyDocsPath(posix, config.healPaths)) {
      continue;
    }
    assertDocsOnlyPatchPath(posix, config);
    allowed.push({ ...p, path: posix });
  }
  return allowed;
}

function isLikelyDocsPath(relPath: string, healPaths: string[]): boolean {
  const lower = relPath.toLowerCase();
  if (/\.(md|mdx|markdown)$/i.test(lower)) return true;
  if (lower.startsWith("docs/") || lower.includes("/docs/")) return true;
  // Honor explicit non-md healPaths entries (e.g. docs/assets/**)
  return healPaths.some((pattern) => {
    const p = pattern.replace(/\\/g, "/");
    if (p.endsWith(".md") || p.endsWith(".mdx") || p.includes("*.md")) {
      return matchesHealPath(relPath, [pattern]);
    }
    // Directory-style healPaths (docs/**) already matched above via matchesHealPath
    return p.includes("docs") && matchesHealPath(relPath, [pattern]);
  });
}

export function findingTouchesDocsOnly(
  finding: HealFinding,
  config: ShtdConfig,
): boolean {
  return matchesHealPath(finding.path, config.healPaths);
}

/** Build a minimal unified diff for a single-file text replacement. */
export function makeUnifiedDiff(
  relPath: string,
  oldContent: string,
  newContent: string,
): string {
  if (oldContent === newContent) return "";
  const oldLines = oldContent.split(/\r?\n/);
  const newLines = newContent.split(/\r?\n/);
  const lines: string[] = [
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
  ];
  // Simple full-file diff (good enough for heal reports / PR bodies)
  for (const l of oldLines) lines.push(`-${l}`);
  for (const l of newLines) lines.push(`+${l}`);
  return lines.join("\n");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Apply replacements; skip entries whose `from` is already absent. */
export function applyReplacements(
  content: string,
  replacements: TextReplacement[],
): string | null {
  let next = content;
  let changed = false;
  for (const { from, to, wholeWord } of replacements) {
    if (!from || from === to) continue;
    if (wholeWord && /^[A-Za-z_][\w]*$/.test(from)) {
      const re = new RegExp(`\\b${escapeRegExp(from)}\\b`, "g");
      if (!re.test(next)) continue;
      next = next.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), to);
      changed = true;
      continue;
    }
    if (!next.includes(from)) continue;
    next = next.split(from).join(to);
    changed = true;
  }
  return changed ? next : null;
}
