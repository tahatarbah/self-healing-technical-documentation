#!/usr/bin/env node
/**
 * E2E: build CLI, scan examples/sample-repo, assert planted findings from FIXTURES.md.
 * Exit 0 on success; non-zero on build failure, bad report, or regression.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sampleRepo = join(root, "examples", "sample-repo");
const cliEntry = join(root, "packages", "cli", "dist", "index.js");

/**
 * Minimum counts derived from examples/sample-repo/FIXTURES.md.
 * Soft floors so extra useful detections do not fail the suite;
 * zero or drop below floor = regression.
 */
const MIN_BY_KIND = {
  drift: 3,
  broken_link: 3,
  broken_anchor: 1,
  broken_image: 1,
  openapi_mismatch: 3,
  example_failure: 2,
};

const REQUIRED_NONZERO = ["drift", "broken_link", "openapi_mismatch"];

function fail(msg) {
  console.error(`e2e FAIL: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  // Avoid shell:true — Windows cmd breaks on spaces in Program Files / user paths.
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    ...opts,
  });
  if (r.error) fail(`${cmd} ${args.join(" ")}: ${r.error.message}`);
  if (r.status !== 0) {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    fail(`${cmd} ${args.join(" ")} exited ${r.status}`);
  }
  return r;
}

function runPnpm(args) {
  // Prefer argv form without shell when possible; on Windows resolve pnpm.cmd via PATH.
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  let r = spawnSync(pnpmCmd, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (r.error && process.platform === "win32") {
    // Fallback: one shell string (avoids DEP0190 arg-array + shell:true)
    const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
    r = spawnSync(`pnpm ${quoted}`, {
      cwd: root,
      encoding: "utf8",
      shell: true,
    });
  }
  if (r.error) fail(`pnpm ${args.join(" ")}: ${r.error.message}`);
  if (r.status !== 0) {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    fail(`pnpm ${args.join(" ")} exited ${r.status}`);
  }
  return r;
}

console.log("e2e: building @shtd/cli...");
runPnpm(["--filter", "@shtd/cli...", "build"]);

const tmp = mkdtempSync(join(tmpdir(), "shtd-e2e-"));
const reportPath = join(tmp, "report.json");

try {
  console.log("e2e: scanning examples/sample-repo...");
  run(process.execPath, [
    cliEntry,
    "scan",
    sampleRepo,
    "--json",
    "-o",
    reportPath,
  ]);

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (e) {
    fail(`could not parse report: ${e instanceof Error ? e.message : e}`);
  }

  if (report?.version !== 1 || report?.tool !== "shtd") {
    fail("report missing version:1 / tool:shtd");
  }
  if (report?.run?.status === "failed") {
    fail(`run status failed: ${report.run.error ?? "(no error)"}`);
  }

  const byKind = { ...(report.run?.stats?.findingsByKind ?? {}) };
  // Prefer stats; fall back to counting findings array
  if (!report.run?.stats?.findingsByKind && Array.isArray(report.run?.findings)) {
    for (const f of report.run.findings) {
      byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    }
  }

  const total =
    report.run?.stats?.findingsTotal ??
    report.run?.findings?.length ??
    0;

  console.log(`e2e: findingsTotal=${total}`);
  console.log("e2e: findingsByKind=", JSON.stringify(byKind, null, 2));

  const errors = [];

  for (const kind of REQUIRED_NONZERO) {
    const n = byKind[kind] ?? 0;
    if (n < 1) errors.push(`expected non-zero ${kind}, got ${n}`);
  }

  for (const [kind, min] of Object.entries(MIN_BY_KIND)) {
    const n = byKind[kind] ?? 0;
    if (n < min) {
      errors.push(`expected at least ${min} ${kind} (FIXTURES.md), got ${n}`);
    }
  }

  if (total < 1) {
    errors.push(`expected findingsTotal >= 1, got ${total}`);
  }

  if (errors.length) {
    for (const e of errors) console.error(`  - ${e}`);
    // Leave report for debugging
    const debugOut = join(root, "shtd-e2e-last-report.json");
    writeFileSync(debugOut, JSON.stringify(report, null, 2));
    console.error(`e2e: wrote debug report to ${debugOut}`);
    fail(`${errors.length} assertion(s) failed`);
  }

  console.log("e2e OK: sample-repo fixture findings meet FIXTURES.md floors");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
