import type { ShtdConfig } from "@shtd/shared";
import {
  expandGlobs,
  readText,
  repoRelative,
  listTsSourceFiles,
} from "../util/fs.js";
import {
  extractFences,
  extractHeadings,
  extractLinks,
  extractOpenApiRefs,
  parseDocSignatures,
  type DocSignature,
  type MdFence,
  type MdHeading,
  type MdLink,
} from "../util/markdown.js";
import { ingestOpenApi, type OpenApiIndex } from "./openapi.js";
import { ingestTsSymbols, type TsSymbolIndex } from "./symbols.js";

export interface DocPage {
  absPath: string;
  relPath: string;
  content: string;
  headings: MdHeading[];
  links: MdLink[];
  fences: MdFence[];
  signatures: DocSignature[];
  openApiRefs: ReturnType<typeof extractOpenApiRefs>;
}

export interface RepoIndex {
  repoPath: string;
  config: ShtdConfig;
  pages: DocPage[];
  openapi: OpenApiIndex[];
  symbols: TsSymbolIndex;
}

export async function ingestRepo(
  repoPath: string,
  config: ShtdConfig,
): Promise<RepoIndex> {
  const docPaths = await expandGlobs(repoPath, config.docs, config.ignore);
  const pages: DocPage[] = [];

  for (const absPath of docPaths) {
    const content = await readText(absPath);
    const fences = extractFences(content);
    const signatures = fences.flatMap((f) =>
      ["ts", "typescript", "js", "javascript", ""].includes(f.lang.toLowerCase())
        ? parseDocSignatures(f.body)
        : [],
    );
    pages.push({
      absPath,
      relPath: repoRelative(repoPath, absPath),
      content,
      headings: extractHeadings(content),
      links: extractLinks(content),
      fences,
      signatures,
      openApiRefs: extractOpenApiRefs(content),
    });
  }

  const openapiPaths = await expandGlobs(
    repoPath,
    config.openapi,
    config.ignore,
  );
  const openapi: OpenApiIndex[] = [];
  for (const absPath of openapiPaths) {
    openapi.push(await ingestOpenApi(repoPath, absPath));
  }

  const tsFiles = await listTsSourceFiles(repoPath, config.ignore);
  const symbols = await ingestTsSymbols(repoPath, tsFiles);

  return { repoPath, config, pages, openapi, symbols };
}
