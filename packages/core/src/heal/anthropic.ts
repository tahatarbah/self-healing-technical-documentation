import Anthropic from "@anthropic-ai/sdk";
import type { HealFinding } from "@shtd/shared";
import { makeUnifiedDiff } from "./patch.js";
import type { LlmProvider, PatchProposal } from "./provider.js";

const SYSTEM = `You are a documentation healer. Your job is to keep Markdown/MDX docs truthful to code and OpenAPI evidence.

Hard constraints:
1. Edit ONLY the documentation file provided. Never invent or modify application source code, configs, or lockfiles.
2. Fix ONLY the issue in the finding. Preserve unrelated sections, headings, lists, frontmatter, and formatting.
3. Prefer the smallest edit that aligns docs with evidence.expected → evidence.actual (or the summary).
4. Do not add speculative new API surface. Do not delete large sections unless they are clearly wrong.
5. Return ONLY valid JSON (no markdown fences): {"newContent":"<full file after edit>","rationale":"<one short sentence>"}
6. If you cannot fix safely, return {"newContent":null,"rationale":"<why>"}`;

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;
  private model: string;

  constructor(model?: string) {
    this.model =
      model ??
      process.env.SHTD_LLM_MODEL ??
      "claude-sonnet-4-20250514";
  }

  isAvailable(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
    return this.client;
  }

  async proposePatch(input: {
    finding: HealFinding;
    docContent: string;
    sourceSnippet?: string;
  }): Promise<PatchProposal | null> {
    if (!this.isAvailable()) return null;

    const { finding, docContent, sourceSnippet } = input;
    const ev = finding.evidence;
    const user = [
      "## Finding",
      `kind: ${finding.kind}`,
      `path: ${finding.path}`,
      `message: ${finding.message ?? ev.summary}`,
      "",
      "## Evidence",
      `summary: ${ev.summary}`,
      ev.details ? `details: ${ev.details}` : "",
      ev.expected != null ? `expected (docs): ${ev.expected}` : "",
      ev.actual != null ? `actual (code/spec): ${ev.actual}` : "",
      ev.sourcePath ? `sourcePath: ${ev.sourcePath}` : "",
      ev.url ? `url: ${ev.url}` : "",
      "",
      sourceSnippet
        ? `## Source snippet (authoritative)\n${sourceSnippet}`
        : "",
      "",
      "## Current documentation file",
      docContent,
      "",
      "Respond with JSON only.",
    ]
      .filter((line) => line !== "")
      .join("\n");

    try {
      const res = await this.getClient().messages.create({
        model: this.model,
        max_tokens: 8192,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      });

      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n");

      const parsed = parseJsonObject(text);
      if (!parsed) return null;
      if (parsed.newContent === null || parsed.newContent === undefined) {
        return null;
      }
      if (typeof parsed.newContent !== "string") return null;

      const newContent = parsed.newContent;
      // Reject empty wipe / unchanged
      if (!newContent.trim() || newContent === docContent) return null;

      const patch = makeUnifiedDiff(finding.path, docContent, newContent);
      if (!patch) return null;

      return {
        findingId: finding.id,
        path: finding.path,
        patch,
        newContent,
        rationale:
          typeof parsed.rationale === "string" && parsed.rationale.trim()
            ? parsed.rationale.trim()
            : "LLM proposed docs-only patch from finding evidence",
        mechanical: false,
        fromLlm: true,
      };
    } catch {
      return null;
    }
  }
}

function parseJsonObject(
  text: string,
): { newContent?: string | null; rationale?: string } | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as {
      newContent?: string | null;
      rationale?: string;
    };
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as {
          newContent?: string | null;
          rationale?: string;
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

export type { HealFinding };
