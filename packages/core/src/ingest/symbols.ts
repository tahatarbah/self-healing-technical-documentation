import ts from "typescript";
import { readText, repoRelative } from "../util/fs.js";

export interface TsFunctionSymbol {
  name: string;
  fileRelPath: string;
  params: Array<{ name: string; optional: boolean; typeText: string }>;
  /** True when params were expanded from an object/type-literal argument. */
  objectStyleParams: boolean;
  returnType: string;
  signatureText: string;
  exported: boolean;
}

export interface TsInterfaceSymbol {
  name: string;
  fileRelPath: string;
  properties: Array<{ name: string; optional: boolean; typeText: string }>;
  requiredProps: string[];
}

export interface TsSymbolIndex {
  functions: Map<string, TsFunctionSymbol>;
  interfaces: Map<string, TsInterfaceSymbol>;
  /** All exported symbol names */
  exports: Set<string>;
}

function typeToString(
  checker: ts.TypeChecker,
  node: ts.Node | undefined,
  fallback: string,
): string {
  if (!node) return fallback;
  try {
    const type = checker.getTypeAtLocation(node);
    return checker.typeToString(type);
  } catch {
    return fallback;
  }
}

function getParamInfo(
  checker: ts.TypeChecker,
  param: ts.ParameterDeclaration,
): { name: string; optional: boolean; typeText: string } {
  const name = param.name.getText();
  const optional = Boolean(param.questionToken || param.initializer);
  const typeText = param.type
    ? param.type.getText()
    : typeToString(checker, param, "unknown");
  return { name, optional, typeText };
}

function expandObjectParamProps(
  checker: ts.TypeChecker,
  param: ts.ParameterDeclaration,
  interfaces: Map<string, TsInterfaceSymbol>,
): Array<{ name: string; optional: boolean; typeText: string }> | null {
  if (!param.type) return null;
  // Inline object type: { a: string; b?: number }
  if (ts.isTypeLiteralNode(param.type)) {
    return param.type.members
      .filter(ts.isPropertySignature)
      .map((m) => ({
        name: (m.name as ts.Identifier).text,
        optional: Boolean(m.questionToken),
        typeText: m.type?.getText() ?? "unknown",
      }));
  }
  // Named type reference
  if (ts.isTypeReferenceNode(param.type) && ts.isIdentifier(param.type.typeName)) {
    const iface = interfaces.get(param.type.typeName.text);
    if (iface) {
      return iface.properties.map((p) => ({
        name: p.name,
        optional: p.optional,
        typeText: p.typeText,
      }));
    }
  }
  return null;
}

export async function ingestTsSymbols(
  repoPath: string,
  absFiles: string[],
): Promise<TsSymbolIndex> {
  const functions = new Map<string, TsFunctionSymbol>();
  const interfaces = new Map<string, TsInterfaceSymbol>();
  const exports = new Set<string>();

  if (absFiles.length === 0) {
    return { functions, interfaces, exports };
  }

  const program = ts.createProgram(absFiles, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();

  // First pass: interfaces / types
  for (const absPath of absFiles) {
    const source = program.getSourceFile(absPath);
    if (!source) continue;
    const rel = repoRelative(repoPath, absPath);

    for (const stmt of source.statements) {
      if (ts.isInterfaceDeclaration(stmt) && stmt.name) {
        const props = stmt.members
          .filter(ts.isPropertySignature)
          .filter((m) => m.name && ts.isIdentifier(m.name))
          .map((m) => ({
            name: (m.name as ts.Identifier).text,
            optional: Boolean(m.questionToken),
            typeText: m.type?.getText() ?? "unknown",
          }));
        const iface: TsInterfaceSymbol = {
          name: stmt.name.text,
          fileRelPath: rel,
          properties: props,
          requiredProps: props.filter((p) => !p.optional).map((p) => p.name),
        };
        interfaces.set(iface.name, iface);
        if (hasExportModifier(stmt)) exports.add(iface.name);
      }
    }
  }

  // Second pass: functions
  for (const absPath of absFiles) {
    const source = program.getSourceFile(absPath);
    if (!source) continue;
    const rel = repoRelative(repoPath, absPath);

    for (const stmt of source.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        const name = stmt.name.text;
        const exported = hasExportModifier(stmt);
        if (exported) exports.add(name);

        const params = stmt.parameters.map((p) => getParamInfo(checker, p));
        // Expand single object param for comparison with docs that inline props
        let expanded = params;
        let objectStyleParams = false;
        if (stmt.parameters.length === 1) {
          const props = expandObjectParamProps(
            checker,
            stmt.parameters[0]!,
            interfaces,
          );
          if (props) {
            expanded = props;
            objectStyleParams = true;
          }
        }

        const returnType = stmt.type
          ? stmt.type.getText()
          : typeToString(checker, stmt, "unknown");

        const signatureText = `${name}(${formatParams(expanded, objectStyleParams)}): ${returnType}`;

        functions.set(name, {
          name,
          fileRelPath: rel,
          params: expanded,
          objectStyleParams,
          returnType,
          signatureText,
          exported,
        });
      }

      // export { a, b } from ...
      if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          exports.add(el.name.text);
        }
      }
    }
  }

  // Ensure re-exported functions are discoverable by reading source text for declarations
  // already covered via createProgram across all files.

  return { functions, interfaces, exports };
}

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(
    ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
  );
}

function formatParams(
  params: Array<{ name: string; optional: boolean; typeText: string }>,
  objectStyle: boolean,
): string {
  if (params.length === 0) return "";
  if (objectStyle) {
    const inner = params
      .map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.typeText}`)
      .join("; ");
    return `{ ${inner} }`;
  }
  return params
    .map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.typeText}`)
    .join(", ");
}

/** Resolve documented name to actual symbol (handles common rename patterns). */
export function resolveSymbolName(
  documented: string,
  index: TsSymbolIndex,
): { symbol?: TsFunctionSymbol; renamedFrom?: string } {
  const direct = index.functions.get(documented);
  if (direct) return { symbol: direct };

  // removeX → deleteX
  if (documented.startsWith("remove")) {
    const alt = "delete" + documented.slice("remove".length);
    const sym = index.functions.get(alt);
    if (sym) return { symbol: sym, renamedFrom: documented };
  }
  // deleteX → removeX (reverse)
  if (documented.startsWith("delete")) {
    const alt = "remove" + documented.slice("delete".length);
    const sym = index.functions.get(alt);
    if (sym) return { symbol: sym, renamedFrom: documented };
  }

  return {};
}

/** Unused but available for richer ingest debugging. */
export async function readSourceSnippet(
  absPath: string,
  maxChars = 2000,
): Promise<string> {
  const text = await readText(absPath);
  return text.slice(0, maxChars);
}
