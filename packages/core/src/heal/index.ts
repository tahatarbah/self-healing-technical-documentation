import type { HealFinding, ShtdConfig } from "@shtd/shared";
import type { RepoIndex } from "../ingest/index.js";
import { matchesHealPath } from "../util/fs.js";
import {
  applyReplacements,
  constrainPatchesToDocs,
  makeUnifiedDiff,
  type FilePatch,
  type TextReplacement,
} from "./patch.js";
import type { LlmProvider, PatchProposal } from "./provider.js";
import { scoreFinding } from "./score.js";
import { AnthropicProvider } from "./anthropic.js";
import { MockProvider } from "./mock.js";
import { resolveProviderName } from "./provider.js";

export { AnthropicProvider, MockProvider };
export type { LlmProvider, PatchProposal, FilePatch };
export { constrainPatchesToDocs, makeUnifiedDiff } from "./patch.js";
export { scoreFinding, applyScores } from "./score.js";

export function createLlmProvider(config?: ShtdConfig): LlmProvider {
  const name = resolveProviderName(config?.llm?.provider);
  if (name === "anthropic") {
    const provider = new AnthropicProvider(config?.llm?.model);
    if (provider.isAvailable()) return provider;
  }
  return new MockProvider();
}

/**
 * Generate patches for findings: mechanical first, then optional LLM.
 * Without an API key, still emits structured findings + mechanical link/rename fixes.
 */
export async function generatePatches(
  index: RepoIndex,
  findings: HealFinding[],
  provider?: LlmProvider,
): Promise<{ findings: HealFinding[]; patches: FilePatch[] }> {
  const llm = provider ?? createLlmProvider(index.config);
  const pageContent = new Map(
    index.pages.map((p) => [p.relPath, p.content] as const),
  );
  const pendingContent = new Map(pageContent);
  const proposals: PatchProposal[] = [];

  // Mechanical patches first (deterministic, high confidence)
  for (const finding of findings) {
    if (!index.config.healPaths.length) continue;
    if (!matchesHealPath(finding.path, index.config.healPaths)) continue;
    const content = pendingContent.get(finding.path);
    if (content === undefined) continue;

    const mechanical = tryMechanicalFix(finding, content, index);
    if (mechanical) {
      proposals.push(mechanical);
      if (mechanical.newContent !== undefined) {
        pendingContent.set(finding.path, mechanical.newContent);
      }
    }
  }

  // LLM for remaining findings without patches
  const patchedIds = new Set(proposals.map((p) => p.findingId));
  if (llm.isAvailable()) {
    for (const finding of findings) {
      if (patchedIds.has(finding.id)) continue;
      if (!matchesHealPath(finding.path, index.config.healPaths)) continue;
      if (finding.kind === "broken_link" || finding.kind === "broken_image") {
        // Missing files usually need human content — skip LLM spam
        continue;
      }
      const content = pendingContent.get(finding.path);
      if (content === undefined) continue;

      let sourceSnippet: string | undefined;
      if (finding.evidence.sourcePath) {
        const symFile = [...index.symbols.functions.values()].find(
          (f) => f.fileRelPath === finding.evidence.sourcePath,
        );
        sourceSnippet = symFile?.signatureText;
        if (!sourceSnippet) {
          // Prefer any exported symbol named in actual/expected
          const name =
            finding.evidence.actual &&
            /^[A-Za-z_][\w]*$/.test(finding.evidence.actual)
              ? finding.evidence.actual
              : undefined;
          if (name && index.symbols.functions.has(name)) {
            sourceSnippet = index.symbols.functions.get(name)!.signatureText;
          }
        }
      }

      const proposal = await llm.proposePatch({
        finding,
        docContent: content,
        sourceSnippet,
      });
      if (proposal && matchesHealPath(proposal.path, index.config.healPaths)) {
        // Never let LLM retarget a different file than the finding
        if (proposal.path !== finding.path) {
          proposal.path = finding.path;
        }
        proposals.push(proposal);
        patchedIds.add(finding.id);
        if (proposal.newContent !== undefined) {
          pendingContent.set(finding.path, proposal.newContent);
        }
      }
    }
  }

  // Merge proposals into findings + FilePatch list
  const byFinding = new Map(proposals.map((p) => [p.findingId, p]));
  const enriched: HealFinding[] = findings.map((f) => {
    const p = byFinding.get(f.id);
    if (!p) return f;
    return {
      ...f,
      patch: p.patch,
      status: "proposed" as const,
      confidence: scoreFinding(f, {
        mechanical: p.mechanical,
        fromLlm: p.fromLlm,
      }),
      message: f.message ?? p.rationale,
    };
  });

  const patchesByPath = new Map<string, FilePatch>();
  for (const p of proposals) {
    const existing = patchesByPath.get(p.path);
    if (existing) {
      existing.findingIds.push(p.findingId);
      if (p.newContent !== undefined) {
        existing.newContent = p.newContent;
        existing.unifiedDiff =
          makeUnifiedDiff(
            p.path,
            pageContent.get(p.path) ?? "",
            p.newContent,
          ) || existing.unifiedDiff;
      }
    } else {
      patchesByPath.set(p.path, {
        path: p.path,
        unifiedDiff: p.patch,
        newContent: p.newContent,
        findingIds: [p.findingId],
      });
    }
  }

  const constrained = constrainPatchesToDocs(
    [...patchesByPath.values()],
    index.config,
  );

  return {
    findings: enriched,
    patches: constrained,
  };
}

function tryMechanicalFix(
  finding: HealFinding,
  content: string,
  _index: RepoIndex,
): PatchProposal | null {
  const replacements: TextReplacement[] = [];

  if (finding.kind === "drift") {
    const expected = finding.evidence.expected;
    const actual = finding.evidence.actual;

    // Full signature replacement when both sides look like signatures
    if (
      expected &&
      actual &&
      expected.includes("(") &&
      actual.includes("(") &&
      content.includes(expected)
    ) {
      replacements.push({ from: expected, to: actual });
    }

    // Symbol rename (removeWidget → deleteWidget)
    const rename = extractIdentifierRename(finding);
    if (rename && content.includes(rename.from)) {
      replacements.push({
        from: rename.from,
        to: rename.to,
        wholeWord: true,
      });
    } else if (
      expected &&
      actual &&
      /^[A-Za-z_][A-Za-z0-9]+$/.test(expected) &&
      /^[A-Za-z_][A-Za-z0-9]+$/.test(actual) &&
      expected.length >= 6 &&
      content.includes(expected)
    ) {
      replacements.push({ from: expected, to: actual, wholeWord: true });
    }

    const details = finding.evidence.details ?? "";
    if (details.includes("`page`") && details.includes("`cursor`")) {
      if (content.includes("page?: number")) {
        replacements.push({ from: "page?: number", to: "cursor?: string" });
      } else if (content.includes("{ page?:")) {
        replacements.push({ from: "{ page?:", to: "{ cursor?:" });
      }
    }
  }

  if (finding.kind === "openapi_mismatch") {
    const expected = finding.evidence.expected;
    const actual = finding.evidence.actual;
    // operationId renames only
    if (
      expected &&
      actual &&
      /^[A-Za-z_][A-Za-z0-9]+$/.test(expected) &&
      /^[A-Za-z_][A-Za-z0-9]+$/.test(actual) &&
      expected.length >= 6 &&
      actual !== "missing" &&
      actual !== "not found" &&
      actual !== "not in spec" &&
      content.includes(expected)
    ) {
      replacements.push({ from: expected, to: actual, wholeWord: true });
    }

    // Query param page → cursor in prose near GET /widgets
    if (expected === "page" && actual === "cursor") {
      if (content.includes("query param `page`")) {
        replacements.push({
          from: "query param `page`",
          to: "query param `cursor`",
        });
      } else if (content.includes("`page` — spec now uses `cursor`")) {
        // already documents the mismatch; leave alone
      } else if (content.includes("page query")) {
        replacements.push({ from: "page query", to: "cursor query" });
      } else if (content.includes("`page`")) {
        // Prefer whole-word-ish backtick swap once
        replacements.push({ from: "`page`", to: "`cursor`" });
      }
    }
  }

  if (finding.kind === "example_failure") {
    const expected = finding.evidence.expected;
    const actual = finding.evidence.actual;
    if (
      expected &&
      actual &&
      /^[A-Za-z_][A-Za-z0-9]+$/.test(expected) &&
      /^[A-Za-z_][A-Za-z0-9]+$/.test(actual) &&
      content.includes(actual)
    ) {
      replacements.push({ from: actual, to: expected, wholeWord: true });
    }
  }

  if (replacements.length === 0) return null;

  const uniq = new Map(
    replacements.map((r) => [`${r.from}=>${r.to}:${r.wholeWord ?? false}`, r]),
  );
  const list = [...uniq.values()];
  const next = applyReplacements(content, list);
  if (next === null || next === content) return null;

  const patch = makeUnifiedDiff(finding.path, content, next);
  if (!patch) return null;

  const preview = list
    .slice(0, 3)
    .map((r) => `\`${r.from}\` → \`${r.to}\``)
    .join(", ");

  return {
    findingId: finding.id,
    path: finding.path,
    patch,
    newContent: next,
    rationale: `Mechanical docs fix from detector evidence (${preview})`,
    mechanical: true,
    fromLlm: false,
  };
}

/** Pull identifier rename from details like `renamed: docs say \`a\`, code exports \`b\``. */
function extractIdentifierRename(
  finding: HealFinding,
): { from: string; to: string } | null {
  const details = finding.evidence.details ?? "";
  const m =
    /renamed:\s*docs say\s*`([A-Za-z_][\w]*)`\s*,\s*code exports\s*`([A-Za-z_][\w]*)`/i.exec(
      details,
    );
  if (m?.[1] && m[2]) return { from: m[1], to: m[2] };

  // Fallback: function name in expected signature vs actual signature
  const expected = finding.evidence.expected;
  const actual = finding.evidence.actual;
  if (!expected || !actual) return null;
  const en = /^([A-Za-z_][\w]*)\s*\(/.exec(expected)?.[1];
  const an = /^([A-Za-z_][\w]*)\s*\(/.exec(actual)?.[1];
  if (en && an && en !== an && en.length >= 6) return { from: en, to: an };
  return null;
}
