/** GitHub-ish heading slug. */
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface MdHeading {
  level: number;
  text: string;
  slug: string;
  line: number;
}

export interface MdLink {
  text: string;
  href: string;
  line: number;
  kind: "link" | "image";
}

export interface MdFence {
  lang: string;
  meta: string;
  body: string;
  line: number;
}

export function extractHeadings(content: string): MdHeading[] {
  const headings: MdHeading[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) {
      const text = (m[2] ?? "").replace(/#+\s*$/, "").trim();
      headings.push({
        level: (m[1] ?? "#").length,
        text,
        slug: slugifyHeading(text),
        line: i + 1,
      });
    }
  }
  return headings;
}

export function extractLinks(content: string): MdLink[] {
  const links: MdLink[] = [];
  const lines = content.split(/\r?\n/);
  const re = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      links.push({
        text: m[2] ?? "",
        href: m[3] ?? "",
        line: i + 1,
        kind: m[1] === "!" ? "image" : "link",
      });
    }
  }
  return links;
}

export function extractFences(content: string): MdFence[] {
  const fences: MdFence[] = [];
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const open = /^```([\w+-]*)\s*(.*)$/.exec(lines[i] ?? "");
    if (!open) {
      i++;
      continue;
    }
    const start = i + 1;
    const lang = open[1] ?? "";
    const meta = (open[2] ?? "").trim();
    i++;
    const bodyLines: string[] = [];
    while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
      bodyLines.push(lines[i] ?? "");
      i++;
    }
    fences.push({
      lang,
      meta,
      body: bodyLines.join("\n"),
      line: start,
    });
    i++;
  }
  return fences;
}

/** Parse a simple TS-ish signature from a fence body (first non-empty line). */
export interface DocSignature {
  name: string;
  paramsRaw: string;
  returnRaw: string;
  raw: string;
}

export function parseDocSignatures(fenceBody: string): DocSignature[] {
  const sigs: DocSignature[] = [];
  const re =
    /^([A-Za-z_][\w]*)\s*\((.*)\)\s*(?::\s*(.+))?$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fenceBody)) !== null) {
    const name = m[1] ?? "";
    // skip imports / keywords
    if (
      ["import", "export", "function", "const", "let", "var", "if", "for"].includes(
        name,
      )
    ) {
      continue;
    }
    sigs.push({
      name,
      paramsRaw: (m[2] ?? "").trim(),
      returnRaw: (m[3] ?? "").trim(),
      raw: m[0].trim(),
    });
  }
  return sigs;
}

/** Extract operationId mentions and HTTP path mentions from prose. */
export function extractOpenApiRefs(content: string): {
  operationIds: string[];
  paths: Array<{ method?: string; path: string }>;
  queryParams: Array<{ pathHint?: string; param: string }>;
} {
  const operationIds = new Set<string>();
  const opRe =
    /operationId\s*[:=]\s*`?([A-Za-z_][\w]*)`?|operation\s+`([A-Za-z_][\w]*)`/gi;
  let m: RegExpExecArray | null;
  while ((m = opRe.exec(content)) !== null) {
    const id = m[1] ?? m[2];
    if (id) operationIds.add(id);
  }
  // bare backticks that look like camelCase ops mentioned near remove/delete/list
  const bareOp = /`([a-z][A-Za-z0-9]+)`/g;
  while ((m = bareOp.exec(content)) !== null) {
    const id = m[1] ?? "";
    if (/^(create|get|list|remove|delete|update|post|put|patch)[A-Z]/.test(id)) {
      operationIds.add(id);
    }
  }

  const paths: Array<{ method?: string; path: string }> = [];
  const pathRe =
    /\b(GET|POST|PUT|PATCH|DELETE)\s+(`)?(\/[^\s`]+)\2?/gi;
  while ((m = pathRe.exec(content)) !== null) {
    paths.push({
      method: (m[1] ?? "").toUpperCase(),
      path: m[3] ?? "",
    });
  }

  const queryParams: Array<{ pathHint?: string; param: string }> = [];
  const qRe =
    /(?:GET\s+`?(\/[\w/{}/-]+)`?\s+)?query\s+(?:param(?:eter)?s?\s+)?`?(\w+)`?/gi;
  while ((m = qRe.exec(content)) !== null) {
    queryParams.push({
      pathHint: m[1],
      param: m[2] ?? "",
    });
  }
  // "query param `page`" / "uses `page`" near GET /widgets
  const pageMention =
    /GET\s+`?\/widgets`?[^.\n]{0,80}\b(page|cursor)\b|query\s+param(?:eter)?\s+`?(page|cursor)`?/gi;
  while ((m = pageMention.exec(content)) !== null) {
    const param = m[1] ?? m[2];
    if (param) {
      queryParams.push({ pathHint: "/widgets", param });
    }
  }

  return {
    operationIds: [...operationIds],
    paths,
    queryParams,
  };
}
