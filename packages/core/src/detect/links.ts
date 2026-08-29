import { dirname, join, normalize } from "node:path";
import type { HealFinding } from "@shtd/shared";
import type { RepoIndex } from "../ingest/index.js";
import { pathExists, repoRelative, toPosix } from "../util/fs.js";
import { findingId } from "../util/ids.js";
import { slugifyHeading } from "../util/markdown.js";

/** Check relative links, anchors, and image paths. */
export async function detectBrokenLinks(
  index: RepoIndex,
): Promise<HealFinding[]> {
  const findings: HealFinding[] = [];
  const pageByRel = new Map(index.pages.map((p) => [p.relPath, p]));

  for (const page of index.pages) {
    for (const link of page.links) {
      const href = link.href.trim();
      if (!href || href.startsWith("mailto:") || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
        continue;
      }

      const hashIdx = href.indexOf("#");
      const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
      const anchor = hashIdx >= 0 ? href.slice(hashIdx + 1) : null;

      // Same-page anchor only
      if (!pathPart) {
        if (anchor) {
          const ok = page.headings.some((h) => h.slug === anchor || h.slug === slugifyHeading(anchor));
          if (!ok) {
            findings.push({
              id: findingId("broken_anchor", page.relPath, anchor),
              kind: "broken_anchor",
              path: page.relPath,
              confidence: "high",
              status: "open",
              message: `Broken anchor \`#${anchor}\` on ${page.relPath}`,
              evidence: {
                summary: `Broken same-page anchor \`#${anchor}\` in ${page.relPath}`,
                details: `No heading slug matches \`${anchor}\`. Available headings are not listed (noise); fix the link or add the section.`,
                docPath: page.relPath,
                url: href,
                expected: `#${anchor}`,
                actual: "heading not found",
              },
            });
          }
        }
        continue;
      }

      const targetAbs = normalize(join(dirname(page.absPath), pathPart));
      const exists = await pathExists(targetAbs);
      const targetRel = toPosix(repoRelative(index.repoPath, targetAbs));

      if (!exists) {
        findings.push({
          id: findingId(
            link.kind === "image" ? "broken_image" : "broken_link",
            page.relPath,
            href,
          ),
          kind: link.kind === "image" ? "broken_image" : "broken_link",
          path: page.relPath,
          confidence: "high",
          status: "open",
          message:
            link.kind === "image"
              ? `Broken image path \`${href}\` in ${page.relPath}`
              : `Broken link \`${href}\` in ${page.relPath}`,
          evidence: {
            summary:
              link.kind === "image"
                ? `Broken image \`${href}\` (file missing)`
                : `Broken link \`${href}\` (file missing)`,
            details: `From \`${page.relPath}\` resolved to \`${targetRel}\`, which does not exist on disk.`,
            docPath: page.relPath,
            url: href,
            expected: targetRel,
            actual: "file missing",
          },
        });
        continue;
      }

      // File exists — check cross-page anchor if present
      if (anchor) {
        let targetPage = pageByRel.get(targetRel);
        if (!targetPage && targetRel.endsWith(".md")) {
          // try with different slash normalization
          targetPage = index.pages.find((p) => p.relPath === targetRel);
        }
        if (targetPage) {
          const ok = targetPage.headings.some(
            (h) => h.slug === anchor || h.slug === slugifyHeading(anchor),
          );
          if (!ok) {
            findings.push({
              id: findingId("broken_anchor", page.relPath, href),
              kind: "broken_anchor",
              path: page.relPath,
              confidence: "high",
              status: "open",
              message: `Broken anchor \`${href}\` from ${page.relPath}`,
              evidence: {
                summary: `Broken cross-page anchor \`${href}\``,
                details: `Target file \`${targetRel}\` exists, but no heading slug matches \`#${anchor}\`.`,
                docPath: page.relPath,
                url: href,
                expected: `${targetRel}#${anchor}`,
                actual: "heading not found",
              },
            });
          }
        }
      }
    }
  }

  return findings;
}
