import { NextResponse, type NextRequest } from "next/server";
import { getRun } from "@/lib/data";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    run: {
      id: run.id,
      repoId: run.repoId,
      repoFullName: run.repoFullName,
      trigger: run.trigger,
      status: run.status,
      commitSha: run.commitSha,
      stats: run.stats,
      error: run.error,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      findings: run.findings.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
      prLinks: run.prLinks.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    },
  });
}
