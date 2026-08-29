import { mkdir, appendFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { constants } from "node:fs";
import type { HealFinding } from "@shtd/shared";
import { findingId } from "./util/ids.js";

export const FEEDBACK_REL_PATH = ".shtd/feedback.jsonl";

export interface LocalFeedbackItem {
  id: string;
  page: string;
  note: string;
  quote?: string;
  createdAt: string;
  status: "open" | "linked" | "dismissed";
  findingId?: string;
}

function feedbackPath(repoPath: string): string {
  return join(repoPath, FEEDBACK_REL_PATH);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Append a reader feedback item to `.shtd/feedback.jsonl`. */
export async function addLocalFeedback(
  repoPath: string,
  input: { page: string; note: string; quote?: string },
): Promise<LocalFeedbackItem> {
  const item: LocalFeedbackItem = {
    id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    page: input.page,
    note: input.note,
    quote: input.quote,
    createdAt: new Date().toISOString(),
    status: "open",
  };

  const path = feedbackPath(repoPath);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(item)}\n`, "utf8");
  return item;
}

/** Load open (and linked) feedback items from the local queue. */
export async function loadLocalFeedback(
  repoPath: string,
): Promise<LocalFeedbackItem[]> {
  const path = feedbackPath(repoPath);
  if (!(await exists(path))) return [];
  const raw = await readFile(path, "utf8");
  const items: LocalFeedbackItem[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as LocalFeedbackItem;
      if (parsed?.page && parsed?.note) items.push(parsed);
    } catch {
      // skip corrupt lines
    }
  }
  return items;
}

/** Map feedback records into heal findings (`kind: feedback`). */
export function findingsFromFeedback(
  items: Array<{
    id?: string;
    page: string;
    note: string;
    quote?: string | null;
  }>,
): HealFinding[] {
  return items
    .filter((item) => item.page && item.note)
    .map((item) => {
      const key = item.id ?? `${item.page}|${item.note.slice(0, 80)}`;
      const id = findingId("feedback", item.page, key);
      const quote = item.quote?.trim();
      return {
        id,
        kind: "feedback" as const,
        path: item.page,
        confidence: "low" as const,
        status: "open" as const,
        message: quote
          ? `Reader feedback on "${quote.slice(0, 80)}": ${item.note}`
          : `Reader feedback: ${item.note}`,
        evidence: {
          summary: quote
            ? `Reader flagged quote on \`${item.page}\``
            : `Reader feedback on \`${item.page}\``,
          docPath: item.page,
          details: item.note,
          expected: quote || undefined,
          actual: "reader reports inaccurate",
        },
      };
    });
}
