#!/usr/bin/env node
/**
 * Composite action step: invoke built `shtd` CLI and emit GitHub Action outputs.
 * Always attempts to leave a JSON report at report-path (including failure stubs).
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

function appendOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) {
    console.log(`${name}=${value}`);
    return;
  }
  writeFileSync(out, `${name}=${String(value)}\n`, { flag: "a" });
}

function writeFailureReport(reportPath, scanPath, mode, errorMessage) {
  const report = {
    version: 1,
    tool: "shtd",
    command: mode === "heal" ? "heal" : "scan",
    repoPath: scanPath,
    generatedAt: new Date().toISOString(),
    run: {
      id: `action_fail_${Date.now()}`,
      trigger: "github_action",
      status: "failed",
      findings: [],
      error: errorMessage,
    },
    patches: [],
  };
  try {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    appendOutput("report-path", reportPath);
    appendOutput("finding-count", "0");
    appendOutput("patch-count", "0");
    appendOutput("status", "failed");
    console.error(`Wrote failure report to ${reportPath}`);
  } catch (err) {
    console.error(
      `Could not write failure report: ${err instanceof Error ? err.message : err}`,
    );
  }
}

function fail(message, code = 1, opts = {}) {
  console.error(`shtd action: ${message}`);
  if (opts.reportPath && opts.scanPath && opts.mode) {
    writeFailureReport(opts.reportPath, opts.scanPath, opts.mode, message);
  }
  process.exit(code);
}

const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const workDirInput = process.env.INPUT_WORKING_DIRECTORY || ".";
const workDir = isAbsolute(workDirInput)
  ? workDirInput
  : resolve(workspace, workDirInput);

const pathInput = process.env.INPUT_PATH || ".";
const scanPath = isAbsolute(pathInput) ? pathInput : resolve(workDir, pathInput);

const mode = (process.env.INPUT_MODE || "heal").toLowerCase();
if (mode !== "scan" && mode !== "heal") {
  fail(`Invalid mode "${mode}" (expected scan|heal)`, 2);
}

const apply =
  String(process.env.INPUT_APPLY || "true").toLowerCase() !== "false";
const reportRel = process.env.INPUT_REPORT_PATH || "shtd-report.json";
const reportPath = isAbsolute(reportRel)
  ? reportRel
  : resolve(workspace, reportRel);

if (!existsSync(scanPath)) {
  fail(`Scan path does not exist: ${scanPath}`, 1, {
    reportPath,
    scanPath,
    mode,
  });
}

const configInput = (process.env.INPUT_CONFIG || "").trim();
if (configInput) {
  const configSrc = isAbsolute(configInput)
    ? configInput
    : resolve(workDir, configInput);
  if (!existsSync(configSrc)) {
    fail(`Config file not found: ${configSrc}`, 1, {
      reportPath,
      scanPath,
      mode,
    });
  }
  const configDest = join(scanPath, "shtd.config.json");
  mkdirSync(dirname(configDest), { recursive: true });
  copyFileSync(configSrc, configDest);
  console.log(`Using config ${configSrc} → ${configDest}`);
}

/** @type {string} */
let cmd;
/** @type {string[]} */
let cmdArgs;

const shtdBinOverride = (process.env.INPUT_SHTD_BIN || "").trim();
if (shtdBinOverride) {
  // Allow either a bare JS entry or a full command string (e.g. "pnpm exec shtd").
  const parts =
    shtdBinOverride.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [shtdBinOverride];
  cmd = parts[0].replace(/^"|"$/g, "");
  cmdArgs = parts.slice(1).map((p) => p.replace(/^"|"$/g, ""));
} else {
  const defaultEntry = join(workDir, "packages", "cli", "dist", "index.js");
  if (!existsSync(defaultEntry)) {
    fail(
      `CLI not built at ${defaultEntry}. In the workflow, run:\n` +
        `  pnpm install && pnpm --filter @shtd/cli... build\n` +
        `Or set input shtd-bin to your shtd entrypoint.`,
      1,
      { reportPath, scanPath, mode },
    );
  }
  cmd = process.execPath;
  cmdArgs = [defaultEntry];
}

mkdirSync(dirname(reportPath), { recursive: true });

// Write report via -o only (avoid dumping full JSON to CI logs with --json).
const args = [
  ...cmdArgs,
  mode,
  scanPath,
  "--trigger",
  "github_action",
  "-o",
  reportPath,
];
if (mode === "heal" && apply) {
  // PR creation is owned by create-heal-pr.mjs; do not pass --pr here.
  args.push("--apply");
}

console.log(`Running: ${cmd} ${args.join(" ")}`);

const result = spawnSync(cmd, args, {
  cwd: workDir,
  env: process.env,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  fail(result.error.message, 1, { reportPath, scanPath, mode });
}

if (result.status !== 0 && result.status !== null) {
  if (!existsSync(reportPath)) {
    writeFailureReport(
      reportPath,
      scanPath,
      mode,
      `shtd exited with code ${result.status}`,
    );
  } else {
    appendOutput("report-path", reportPath);
    try {
      const existing = JSON.parse(readFileSync(reportPath, "utf8"));
      appendOutput(
        "finding-count",
        String(existing?.run?.findings?.length ?? 0),
      );
      appendOutput("patch-count", String(existing?.patches?.length ?? 0));
      appendOutput("status", existing?.run?.status ?? "failed");
    } catch {
      appendOutput("finding-count", "0");
      appendOutput("patch-count", "0");
      appendOutput("status", "failed");
    }
  }
  fail(`shtd exited with code ${result.status}`, result.status);
}

if (!existsSync(reportPath)) {
  fail(`Expected report at ${reportPath} but file is missing`, 1, {
    reportPath,
    scanPath,
    mode,
  });
}

/** @type {any} */
let report = {};
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (err) {
  fail(
    `Failed to parse report: ${err instanceof Error ? err.message : err}`,
    1,
    { reportPath, scanPath, mode },
  );
}

const findings = report?.run?.findings ?? [];
const patches = report?.patches ?? [];
const status = report?.run?.status ?? "completed";

appendOutput("report-path", reportPath);
appendOutput("finding-count", String(findings.length));
appendOutput("patch-count", String(patches.length));
appendOutput("status", status);

console.log(
  `shtd ${mode} finished: status=${status}, findings=${findings.length}, patches=${patches.length}`,
);
console.log(`JSON report: ${reportPath}`);
