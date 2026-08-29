#!/usr/bin/env node
/**
 * `shtd` — Self-Healing Technical Documentation CLI
 *
 * Commands:
 *   shtd scan [path] [--json] [-o report.json] [--trigger cli|schedule|…]
 *   shtd heal [path] [--pr] [--apply] [--json] [-o report.json] [--trigger …]
 *   shtd feedback add --page PATH --note TEXT [--quote TEXT] [repoPath]
 *   shtd help
 *
 * Exit codes:
 *   0  Success (findings are reported, not treated as failure)
 *   1  Engine/run failure, API error, or unknown command
 *   2  Usage error (bad flags / missing required args)
 *
 * Cron-friendly: exit 0 on successful detect (findings ≠ failure). Use --json + -o
 * for artifacts. Example: `0 6 * * 1 cd /repo && shtd scan --trigger schedule --json -o /tmp/shtd.json`
 */
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import type { RunTrigger } from "@shtd/shared";
import {
  scan,
  heal,
  toScanReport,
  formatHumanSummary,
  addLocalFeedback,
  CORE_PACKAGE_NAME,
  type ScanReport,
} from "@shtd/core";

const TRIGGERS = new Set<RunTrigger>([
  "cli",
  "github_action",
  "schedule",
  "feedback",
  "manual",
]);

interface CliArgs {
  command: string;
  subcommand?: string;
  path: string;
  json: boolean;
  pr: boolean;
  apply: boolean;
  out?: string;
  help: boolean;
  trigger: RunTrigger;
  page?: string;
  note?: string;
  quote?: string;
  api?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args = [...argv];
  const command = args.shift() ?? "help";
  let subcommand: string | undefined;
  if (command === "feedback") {
    subcommand = args.shift() ?? "help";
  }

  let path = process.cwd();
  let json = false;
  let pr = false;
  let apply = false;
  let out: string | undefined;
  let help = false;
  let trigger: RunTrigger = command === "feedback" ? "feedback" : "cli";
  let page: string | undefined;
  let note: string | undefined;
  let quote: string | undefined;
  let api: string | undefined;

  const positionals: string[] = [];
  while (args.length) {
    const a = args.shift()!;
    if (a === "--help" || a === "-h") {
      help = true;
    } else if (a === "--json") {
      json = true;
    } else if (a === "--pr") {
      pr = true;
    } else if (a === "--apply") {
      apply = true;
    } else if (a === "-o" || a === "--out") {
      out = args.shift();
      if (!out) {
        console.error("Missing value for -o/--out");
        process.exit(2);
      }
    } else if (a === "--trigger") {
      const t = args.shift();
      if (!t || !TRIGGERS.has(t as RunTrigger)) {
        console.error(
          `Invalid --trigger. Expected one of: ${[...TRIGGERS].join(", ")}`,
        );
        process.exit(2);
      }
      trigger = t as RunTrigger;
    } else if (a === "--page") {
      page = args.shift();
      if (!page) {
        console.error("Missing value for --page");
        process.exit(2);
      }
    } else if (a === "--note") {
      note = args.shift();
      if (!note) {
        console.error("Missing value for --note");
        process.exit(2);
      }
    } else if (a === "--quote") {
      quote = args.shift();
      if (quote === undefined) {
        console.error("Missing value for --quote");
        process.exit(2);
      }
    } else if (a === "--api") {
      api = args.shift();
      if (!api) {
        console.error("Missing value for --api");
        process.exit(2);
      }
    } else if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      console.error("Try `shtd help` for usage.");
      process.exit(2);
    } else {
      positionals.push(a);
    }
  }

  if (positionals[0]) {
    path = resolve(positionals[0]);
  }

  return {
    command,
    subcommand,
    path,
    json,
    pr,
    apply,
    out,
    help,
    trigger,
    page,
    note,
    quote,
    api,
  };
}

function printHelp(): void {
  console.log(`shtd — Self-Healing Technical Documentation

Usage:
  shtd scan [path] [--json] [-o report.json] [--trigger schedule]
  shtd heal [path] [--pr] [--apply] [--json] [-o report.json] [--trigger schedule]
  shtd feedback add --page PATH --note TEXT [--quote TEXT] [--api URL] [repoPath]
  shtd help

Options:
  --json              Print machine-readable JSON report to stdout
  -o, --out FILE      Write JSON report to FILE
  --trigger VALUE     Run trigger: cli | github_action | schedule | feedback | manual
  --pr                (heal) Attempt GitHub PR when token is available
  --apply             (heal) Write docs-only patches to the working tree
  --page PATH         (feedback) Docs page path, e.g. docs/api.md
  --note TEXT         (feedback) What's wrong
  --quote TEXT        (feedback) Optional cited snippet
  --api URL           (feedback) Also POST to dashboard /api/feedback
  -h, --help          Show this message

Exit codes:
  0   Success — scan/heal completed (findings do not fail the process)
  1   Engine failure, run status=failed, API error, or unknown command
  2   Usage error — bad flags, invalid --trigger, missing --page/--note

Scheduled scans (cron-friendly):
  # Mondays 06:00 — detect only, write artifact (exit 0 unless engine fails)
  0 6 * * 1 cd /path/to/repo && shtd scan --trigger schedule --json -o /var/shtd/scan.json

  # Heal + PR; auto-merge only when shtd.config.json autoMerge.enabled
  # and all patches are high confidence (+ SHTD_CI_STATUS=success when requireGreenCi)
  0 7 * * 1 cd /path/to/repo && SHTD_CI_STATUS=success shtd heal --pr --trigger schedule -o /var/shtd/heal.json

Config:
  Loads shtd.config.json (docs globs, openapi, healPaths, autoMerge, schedule).
  Missing file → defaults. Invalid JSON/schema → exit 1 with field errors.

Engine: ${CORE_PACKAGE_NAME}
`);
}

async function writeReport(
  report: ScanReport,
  opts: { json: boolean; out?: string },
): Promise<void> {
  const text = JSON.stringify(report, null, 2);
  if (opts.out) {
    await writeFile(opts.out, text, "utf8");
    if (!opts.json) {
      console.error(`Wrote report to ${opts.out}`);
    }
  }
  if (opts.json) {
    console.log(text);
  }
}

async function runFeedbackAdd(opts: CliArgs): Promise<void> {
  const page = opts.page?.trim();
  const note = opts.note?.trim();
  const quote = opts.quote?.trim();

  if (!page || !note) {
    console.error("feedback add requires --page and --note");
    console.error(
      'Example: shtd feedback add --page docs/api.md --note "Pagination is wrong" ./repo',
    );
    process.exit(2);
  }

  if (!/[./\\]/.test(page) && !/\.(md|mdx)$/i.test(page)) {
    console.error(
      `Warning: --page "${page}" does not look like a docs path (expected e.g. docs/api.md). Continuing anyway.`,
    );
  }

  const item = await addLocalFeedback(opts.path, {
    page,
    note,
    quote: quote || undefined,
  });

  let apiFindingId: string | undefined;
  if (opts.api) {
    const endpoint = opts.api.replace(/\/$/, "");
    const url = endpoint.endsWith("/api/feedback")
      ? endpoint
      : `${endpoint}/api/feedback`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          note,
          quote: quote || undefined,
          repoFullName: process.env.SHTD_REPO_FULL_NAME,
          repoId: process.env.SHTD_REPO_ID,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`API feedback failed (${res.status}): ${body}`);
        process.exit(1);
      }
      const data = (await res.json()) as {
        feedback?: { findingId?: string | null };
      };
      apiFindingId = data.feedback?.findingId ?? undefined;
    } catch (err) {
      console.error(
        `API feedback request failed: ${err instanceof Error ? err.message : err}`,
      );
      process.exit(1);
    }
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        { local: item, apiFindingId: apiFindingId ?? null },
        null,
        2,
      ),
    );
  } else {
    console.log(`Queued feedback ${item.id}`);
    console.log(`  Page:  ${item.page}`);
    console.log(`  Note:  ${item.note}`);
    if (item.quote) console.log(`  Quote: ${item.quote}`);
    console.log(`  Queue: ${opts.path}/.shtd/feedback.jsonl`);
    if (opts.api) {
      console.log(
        `  API:   posted${apiFindingId ? ` (finding ${apiFindingId})` : ""}`,
      );
    }
    console.log("");
    console.log(
      "Next: run `shtd scan` or `shtd heal` to surface kind:feedback findings.",
    );
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (
    opts.help ||
    opts.command === "help" ||
    opts.command === "--help" ||
    opts.command === "-h"
  ) {
    printHelp();
    process.exit(0);
  }

  if (opts.command === "feedback") {
    if (opts.subcommand === "add") {
      await runFeedbackAdd(opts);
      process.exit(0);
    }
    console.error(
      `shtd feedback: unknown subcommand "${opts.subcommand}". Try \`shtd feedback add\`.`,
    );
    process.exit(2);
  }

  if (opts.command === "scan") {
    const result = await scan(opts.path, { trigger: opts.trigger });
    const report = toScanReport({
      command: "scan",
      repoPath: opts.path,
      run: result.run,
      graphSummary: result.graphSummary,
      config: result.config,
    });

    if (!opts.json) {
      console.log(`shtd scan — ${opts.path} (trigger=${opts.trigger})`);
      console.log(formatHumanSummary(result.run));
      if (result.config.schedule.enabled) {
        console.log("");
        console.log(
          `Schedule hint: cron="${result.config.schedule.cron}" (Action YAML owns the workflow timer)`,
        );
      }
      if (result.run.error) {
        console.error(`Error: ${result.run.error}`);
      }
    }

    await writeReport(report, opts);

    if (result.run.status === "failed") process.exit(1);
    // Exit 0 even with findings (detect-only); CI can parse JSON
    process.exit(0);
  }

  if (opts.command === "heal") {
    const result = await heal(opts.path, {
      trigger: opts.trigger,
      pr: opts.pr,
      apply: opts.apply,
    });
    const report = toScanReport({
      command: "heal",
      repoPath: opts.path,
      run: result.run,
      graphSummary: result.graphSummary,
      patches: result.patches,
      prUrl: result.prUrl,
      prSkippedReason: result.prSkippedReason,
      autoMerge: result.autoMerge,
      config: result.config,
    });

    if (!opts.json) {
      console.log(`shtd heal — ${opts.path} (trigger=${opts.trigger})`);
      console.log(formatHumanSummary(result.run));
      console.log("");
      if (result.patches.length) {
        console.log(`Patches (${result.patches.length} file(s)):`);
        for (const p of result.patches) {
          console.log(`  - ${p.path} (${p.findingIds.length} finding(s))`);
        }
      } else {
        console.log("No patches generated (findings still reported).");
      }
      if (result.autoMerge) {
        console.log(
          `Auto-merge: ${result.autoMerge.eligible ? "eligible" : "blocked"} — ${result.autoMerge.reason}`,
        );
      }
      if (opts.pr) {
        if (result.prUrl) console.log(`PR: ${result.prUrl}`);
        if (result.prSkippedReason) {
          console.log(`PR skipped: ${result.prSkippedReason}`);
        }
      }
      if (result.run.error) {
        console.error(`Error: ${result.run.error}`);
      }
    }

    await writeReport(report, opts);

    if (result.run.status === "failed") process.exit(1);
    process.exit(0);
  }

  console.error(`shtd: unknown command "${opts.command}". Try \`shtd help\`.`);
  process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
