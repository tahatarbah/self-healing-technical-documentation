#!/usr/bin/env node
/**
 * Composite action step: commit applied docs patches and open a heal PR via gh.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

function appendOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) {
    console.log(`${name}=${value}`);
    return;
  }
  writeFileSync(out, `${name}=${String(value)}\n`, { flag: "a" });
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  return result;
}

function runOrThrow(cmd, args, opts = {}) {
  const result = run(cmd, args, opts);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed (exit ${result.status}): ${result.stderr || result.stdout || ""}`,
    );
  }
  return result;
}

const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const workDirInput = process.env.INPUT_WORKING_DIRECTORY || ".";
const workDir = isAbsolute(workDirInput)
  ? workDirInput
  : resolve(workspace, workDirInput);

const reportRel = process.env.INPUT_REPORT_PATH || "shtd-report.json";
const reportPath = isAbsolute(reportRel) ? reportRel : resolve(workspace, reportRel);

if (!existsSync(reportPath)) {
  console.log(`No report at ${reportPath}; skipping heal PR.`);
  appendOutput("pr-url", "");
  process.exit(0);
}

/** @type {any} */
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const patches = report.patches ?? [];
const findings = report.run?.findings ?? [];
const findingCount = report.run?.stats?.findingsTotal ?? findings.length;

if (!patches.length) {
  console.log("No docs patches in report; skipping heal PR.");
  appendOutput("pr-url", "");
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
  console.log("GITHUB_TOKEN not set; skipping heal PR.");
  appendOutput("pr-url", "");
  process.exit(0);
}

const prefix = process.env.INPUT_PR_BRANCH_PREFIX || "shtd/heal";
const runId = report.run?.id || String(Date.now());
const branch = `${prefix}-${String(runId).replace(/[^a-zA-Z0-9._/-]/g, "-").slice(0, 40)}`;

const labels = report.configSummary
  ? ["self-heal"]
  : ["self-heal"];

// Ensure gh sees the token
process.env.GH_TOKEN = token;
process.env.GITHUB_TOKEN = token;

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "shtd-bot",
  GIT_AUTHOR_EMAIL: "shtd-bot@users.noreply.github.com",
  GIT_COMMITTER_NAME: "shtd-bot",
  GIT_COMMITTER_EMAIL: "shtd-bot@users.noreply.github.com",
};

try {
  // Only stage patched docs files (never commit unrelated dirty files).
  const patchPaths = patches.map((p) => p.path).filter(Boolean);
  if (!patchPaths.length) {
    appendOutput("pr-url", "");
    process.exit(0);
  }

  runOrThrow("git", ["config", "user.name", "shtd-bot"], { cwd: workDir, env: gitEnv });
  runOrThrow("git", ["config", "user.email", "shtd-bot@users.noreply.github.com"], {
    cwd: workDir,
    env: gitEnv,
  });

  // Detach onto a new branch from current HEAD
  const checkout = run("git", ["checkout", "-B", branch], { cwd: workDir, env: gitEnv });
  if (checkout.stdout) process.stdout.write(checkout.stdout);
  if (checkout.stderr) process.stderr.write(checkout.stderr);
  if (checkout.status !== 0) {
    throw new Error(`git checkout -B ${branch} failed`);
  }

  runOrThrow("git", ["add", "--", ...patchPaths], { cwd: workDir, env: gitEnv });

  const staged = run("git", ["diff", "--cached", "--name-only"], {
    cwd: workDir,
    env: gitEnv,
  });
  const stagedFiles = (staged.stdout || "").trim();
  if (!stagedFiles) {
    console.log("No staged changes after apply; skipping heal PR.");
    appendOutput("pr-url", "");
    process.exit(0);
  }

  const title = `docs: self-heal (${findingCount} finding(s))`;
  const bodyLines = [
    "## Self-healing technical documentation",
    "",
    `Automated heal run \`${runId}\` proposed docs-only patches.`,
    "",
    "### Findings",
    "",
    ...findings.slice(0, 50).map((f) => {
      const msg = f.message || f.evidence?.summary || "(no summary)";
      return `- **${f.kind}** (\`${f.confidence}\`) \`${f.path}\`: ${msg}`;
    }),
    findings.length > 50 ? `\n_…and ${findings.length - 50} more._` : "",
    "",
    "### Patches",
    "",
    ...patchPaths.map((p) => `- \`${p}\``),
    "",
    "Patches are constrained to documentation paths only.",
    "",
    `Report artifact path: \`${reportPath}\``,
  ].filter((line) => line !== undefined);

  runOrThrow("git", ["commit", "-m", title], { cwd: workDir, env: gitEnv });

  const push = run("git", ["push", "-u", "origin", `HEAD:${branch}`], {
    cwd: workDir,
    env: gitEnv,
  });
  if (push.stdout) process.stdout.write(push.stdout);
  if (push.stderr) process.stderr.write(push.stderr);
  if (push.status !== 0) {
    throw new Error(`git push failed: ${push.stderr || push.stdout}`);
  }

  const prArgs = [
    "pr",
    "create",
    "--title",
    title,
    "--body",
    bodyLines.join("\n"),
    "--head",
    branch,
  ];
  for (const label of labels) {
    prArgs.push("--label", label);
  }

  const pr = run("gh", prArgs, { cwd: workDir, env: process.env });
  if (pr.stdout) process.stdout.write(pr.stdout);
  if (pr.stderr) process.stderr.write(pr.stderr);

  let prUrl = "";
  if (pr.status === 0) {
    prUrl = (pr.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() || "";
  } else {
    // Label may not exist; retry without labels
    console.warn("gh pr create with labels failed; retrying without labels…");
    const retry = run(
      "gh",
      ["pr", "create", "--title", title, "--body", bodyLines.join("\n"), "--head", branch],
      { cwd: workDir, env: process.env },
    );
    if (retry.stdout) process.stdout.write(retry.stdout);
    if (retry.stderr) process.stderr.write(retry.stderr);
    if (retry.status !== 0) {
      throw new Error(`gh pr create failed: ${retry.stderr || retry.stdout}`);
    }
    prUrl = (retry.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() || "";
  }

  // Persist prUrl back into the report for the artifact
  try {
    report.prUrl = prUrl || report.prUrl;
    delete report.prSkippedReason;
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  } catch {
    // non-fatal
  }

  appendOutput("pr-url", prUrl);
  console.log(prUrl ? `Heal PR: ${prUrl}` : "Heal PR created (no URL parsed)");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  appendOutput("pr-url", "");
  // Non-fatal for the overall action: report + comment can still proceed.
  process.exit(0);
}
