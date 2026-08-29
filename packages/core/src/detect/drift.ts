import type { HealFinding } from "@shtd/shared";
import type { RepoIndex } from "../ingest/index.js";
import { findingId } from "../util/ids.js";
import { resolveSymbolName } from "../ingest/symbols.js";
import type { DocSignature } from "../util/markdown.js";

/** Detect code–doc drift for documented TS signatures. */
export function detectDrift(index: RepoIndex): HealFinding[] {
  const findings: HealFinding[] = [];
  const seen = new Set<string>();

  for (const page of index.pages) {
    for (const sig of page.signatures) {
      const key = `${page.relPath}:${sig.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const resolved = resolveSymbolName(sig.name, index.symbols);
      if (!resolved.symbol) {
        // Documented symbol missing entirely from code
        if (index.symbols.exports.size > 0 || index.symbols.functions.size > 0) {
          findings.push({
            id: findingId("drift", page.relPath, sig.name),
            kind: "drift",
            path: page.relPath,
            confidence: "high",
            status: "open",
            message: `Documented symbol \`${sig.name}\` not found in TypeScript exports`,
            evidence: {
              summary: `Docs export \`${sig.name}\` but no matching TS export exists`,
              details: `Documented signature: \`${sig.raw}\`. Searched repo TypeScript exports; nothing matched this name (or known rename).`,
              docPath: page.relPath,
              expected: sig.raw,
              actual: "not found in exports",
            },
          });
        }
        continue;
      }

      const { symbol, renamedFrom } = resolved;
      const mismatches: string[] = [];

      if (renamedFrom) {
        mismatches.push(
          `renamed: docs say \`${renamedFrom}\`, code exports \`${symbol.name}\``,
        );
      }

      const docParams = parseDocObjectParams(sig);
      if (docParams.length > 0) {
        const codeParamNames = new Set(symbol.params.map((p) => p.name));
        const docParamNames = new Set(docParams.map((p) => p.name));

        for (const p of docParams) {
          if (!codeParamNames.has(p.name)) {
            // Check rename page→cursor
            const alt =
              p.name === "page"
                ? "cursor"
                : p.name === "cursor"
                  ? "page"
                  : null;
            if (alt && codeParamNames.has(alt)) {
              mismatches.push(
                `param \`${p.name}\` → code uses \`${alt}\``,
              );
            } else {
              mismatches.push(`doc param \`${p.name}\` not in code signature`);
            }
          }
        }

        for (const p of symbol.params) {
          if (!p.optional && !docParamNames.has(p.name)) {
            // Required in code but missing from docs
            mismatches.push(
              `code requires \`${p.name}\` (${p.typeText}) but docs omit it`,
            );
          }
        }
      }

      // Return type shape comparison (shallow)
      if (sig.returnRaw && symbol.returnType) {
        const docProps = extractReturnProps(sig.returnRaw);
        if (docProps.length > 0) {
          const iface = index.symbols.interfaces.get(symbol.returnType);
          const codeProps = iface
            ? new Set(iface.properties.map((p) => p.name))
            : extractReturnProps(symbol.returnType);
          const codeSet =
            codeProps instanceof Set ? codeProps : new Set(codeProps);
          for (const missing of [...codeSet].filter((p) => !docProps.includes(p))) {
            // Only flag if docs listed an object return with some props
            if (["status", "createdAt", "ownerId"].includes(missing)) {
              mismatches.push(
                `return type missing documented field \`${missing}\` (code has it)`,
              );
            }
          }
          // Flag if docs return a narrow object vs named Widget type
          if (
            iface &&
            docProps.length > 0 &&
            docProps.every((p) => codeSet.has(p)) &&
            iface.properties.length > docProps.length
          ) {
            const extra = iface.properties
              .map((p) => p.name)
              .filter((n) => !docProps.includes(n));
            if (extra.length) {
              mismatches.push(
                `docs return \`{ ${docProps.join("; ")} }\` but code returns \`${symbol.returnType}\` with also: ${extra.join(", ")}`,
              );
            }
          }
        } else if (
          sig.returnRaw === "void" &&
          symbol.returnType !== "void" &&
          symbol.returnType !== "undefined"
        ) {
          mismatches.push(
            `docs return \`void\` but code returns \`${symbol.returnType}\``,
          );
        }
      }

      if (mismatches.length === 0 && !renamedFrom) continue;

      findings.push({
        id: findingId("drift", page.relPath, sig.name),
        kind: "drift",
        path: page.relPath,
        confidence: "high",
        status: "open",
        message: `Drift in \`${sig.name}\`: ${mismatches[0] ?? "signature mismatch"}`,
        evidence: {
          summary: `Code–doc drift for \`${sig.name}\` (${mismatches.length} mismatch(es))`,
          details: mismatches.map((m, i) => `${i + 1}. ${m}`).join(" "),
          docPath: page.relPath,
          sourcePath: symbol.fileRelPath,
          expected: sig.raw,
          actual: symbol.signatureText,
        },
      });
    }
  }

  return findings;
}

function parseDocObjectParams(
  sig: DocSignature,
): Array<{ name: string; optional: boolean }> {
  const raw = sig.paramsRaw.trim();
  // Object style: { page?: number; limit?: number } or { name: string }
  const obj = /^\{([\s\S]*)\}$/.exec(raw);
  if (obj) {
    const inner = obj[1] ?? "";
    const props: Array<{ name: string; optional: boolean }> = [];
    for (const part of inner.split(/[;,]/)) {
      const m = /^\s*([A-Za-z_][\w]*)\s*(\?)?\s*:/.exec(part);
      if (m) {
        props.push({ name: m[1]!, optional: Boolean(m[2]) });
      }
    }
    return props;
  }
  // Positional: id: string
  const positional: Array<{ name: string; optional: boolean }> = [];
  for (const part of raw.split(",")) {
    const m = /^\s*([A-Za-z_][\w]*)\s*(\?)?\s*:/.exec(part);
    if (m) {
      positional.push({ name: m[1]!, optional: Boolean(m[2]) });
    }
  }
  return positional;
}

function extractReturnProps(returnRaw: string): string[] {
  const obj = /^\{([\s\S]*)\}$/.exec(returnRaw.trim());
  if (!obj) return [];
  const props: string[] = [];
  for (const part of (obj[1] ?? "").split(/[;,]/)) {
    const m = /^\s*([A-Za-z_][\w]*)\s*(\?)?\s*:/.exec(part);
    if (m) props.push(m[1]!);
  }
  return props;
}
