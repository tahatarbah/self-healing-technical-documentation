import ts from "typescript";
import type { HealFinding } from "@shtd/shared";
import type { RepoIndex } from "../ingest/index.js";
import { findingId } from "../util/ids.js";

const KEYWORDS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "function",
  "catch",
  "console",
  "return",
  "typeof",
  "new",
  "await",
  "async",
  "import",
  "export",
  "const",
  "let",
  "var",
  "class",
  "extends",
  "from",
  "as",
  "of",
  "in",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "this",
  "super",
  "try",
  "throw",
  "else",
  "do",
  "break",
  "continue",
  "case",
  "default",
  "interface",
  "type",
  "enum",
  "implements",
]);

function wantsValidate(lang: string, meta: string): boolean {
  const blob = `${lang} ${meta}`.toLowerCase();
  return /\bvalidate\b/.test(blob);
}

function isTsLike(lang: string): boolean {
  const l = lang.toLowerCase();
  return l === "ts" || l === "tsx" || l === "typescript" || l === "js" || l === "jsx" || l === "javascript";
}

/**
 * Parse / lightly typecheck a fenced example with the TypeScript compiler API.
 * Returns diagnostics as strings (syntax + basic semantic where feasible).
 */
export function validateTsExample(body: string, fileName = "example.ts"): string[] {
  const scriptKind =
    fileName.endsWith("tsx") || fileName.endsWith("jsx")
      ? ts.ScriptKind.TSX
      : fileName.endsWith("js") || fileName.endsWith("jsx")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;

  const sourceFile = ts.createSourceFile(
    fileName,
    body,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const syntactic = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
    .parseDiagnostics;
  const diags: string[] = [];

  if (syntactic?.length) {
    for (const d of syntactic) {
      diags.push(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    }
  }

  // transpileModule catches many syntax issues even when parseDiagnostics is empty
  const transpiled = ts.transpileModule(body, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      noEmit: true,
    },
    reportDiagnostics: true,
    fileName,
  });
  for (const d of transpiled.diagnostics ?? []) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!diags.includes(msg)) diags.push(msg);
  }

  // Walk for unbalanced template / obvious empty call issues already covered;
  // also detect bare `remove*` calls against known renames via caller.
  void sourceFile;
  return diags;
}

function collectCallNames(body: string): string[] {
  const names: string[] = [];
  const calls = body.matchAll(/\b([A-Za-z_][\w]*)\s*\(/g);
  for (const m of calls) {
    const name = m[1] ?? "";
    if (!name || KEYWORDS.has(name)) continue;
    names.push(name);
  }
  return names;
}

/**
 * Validate fenced examples tagged `validate`.
 * - TS/JS: parse via TypeScript compiler + symbol/rename checks against repo index
 * - Other langs: brace balance only
 */
export function detectExampleFailures(index: RepoIndex): HealFinding[] {
  const findings: HealFinding[] = [];

  for (const page of index.pages) {
    for (const fence of page.fences) {
      if (!wantsValidate(fence.lang, fence.meta)) continue;

      const lang = fence.lang.toLowerCase() || "ts";

      if (isTsLike(lang)) {
        const fileName =
          lang === "tsx" || lang === "jsx"
            ? `example.${lang}`
            : lang.startsWith("js")
              ? "example.js"
              : "example.ts";
        const parseErrors = validateTsExample(fence.body, fileName);
        const seenDiag = new Set<string>();
        for (const [i, msg] of parseErrors.entries()) {
          if (seenDiag.has(msg)) continue;
          seenDiag.add(msg);
          findings.push({
            id: findingId(
              "example_failure",
              page.relPath,
              `parse:${fence.line}:${i}`,
            ),
            kind: "example_failure",
            path: page.relPath,
            confidence: "medium",
            status: "open",
            message: `Example at line ${fence.line} failed validation: ${msg}`,
            evidence: {
              summary: `Validate example at line ${fence.line} failed parse/typecheck`,
              docPath: page.relPath,
              details: msg,
              expected: "valid TypeScript/JavaScript example",
              actual: fence.body.slice(0, 400),
            },
          });
        }

        for (const name of collectCallNames(fence.body)) {
          if (
            index.symbols.functions.size === 0 &&
            index.symbols.exports.size === 0
          ) {
            continue;
          }
          const known =
            index.symbols.functions.has(name) || index.symbols.exports.has(name);
          if (known) continue;

          const alt = name.startsWith("remove")
            ? "delete" + name.slice("remove".length)
            : null;
          if (alt && index.symbols.functions.has(alt)) {
            findings.push({
              id: findingId("example_failure", page.relPath, name),
              kind: "example_failure",
              path: page.relPath,
              confidence: "medium",
              status: "open",
              message: `Example calls \`${name}\` which was renamed to \`${alt}\``,
              evidence: {
                summary: `Stale example call: ${name}`,
                docPath: page.relPath,
                expected: alt,
                actual: name,
                details: `Fenced example at line ${fence.line} (validate)`,
              },
            });
            continue;
          }

          // Unknown call that looks like a public API symbol (camelCase verb*)
          if (/^(create|get|list|remove|delete|update|post|put|patch)[A-Z]/.test(name)) {
            findings.push({
              id: findingId("example_failure", page.relPath, `unknown:${name}`),
              kind: "example_failure",
              path: page.relPath,
              confidence: "medium",
              status: "open",
              message: `Example calls unknown symbol \`${name}\``,
              evidence: {
                summary: `Unknown example symbol: ${name}`,
                docPath: page.relPath,
                actual: name,
                details: `Fenced example at line ${fence.line} (validate)`,
              },
            });
          }
        }
      } else {
        const opens = (fence.body.match(/\{/g) ?? []).length;
        const closes = (fence.body.match(/\}/g) ?? []).length;
        if (opens !== closes) {
          findings.push({
            id: findingId(
              "example_failure",
              page.relPath,
              `brace:${fence.line}`,
            ),
            kind: "example_failure",
            path: page.relPath,
            confidence: "medium",
            status: "open",
            message: `Example at line ${fence.line} has unbalanced braces`,
            evidence: {
              summary: "Unbalanced braces in validate example",
              docPath: page.relPath,
            },
          });
        }
      }
    }
  }

  return findings;
}
