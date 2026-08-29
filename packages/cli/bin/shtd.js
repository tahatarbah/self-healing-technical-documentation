#!/usr/bin/env node
/**
 * Thin bin stub so `pnpm install` can link `shtd` before `dist/` exists.
 * Prefer the compiled entry after `pnpm build`.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist", "index.js");

if (!existsSync(dist)) {
  console.error("shtd: package not built yet. Run `pnpm --filter @shtd/cli build` first.");
  process.exit(1);
}

await import(pathToFileURL(dist).href);
