import { NextResponse, type NextRequest } from "next/server";
import { listRuns } from "@/lib/data";

export async function GET(request: NextRequest) {
  const repoId = request.nextUrl.searchParams.get("repoId") ?? undefined;
  const runs = await listRuns(repoId);
  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      repoId: r.repoId,
      repoFullName: r.repoFullName,
      trigger: r.trigger,
      status: r.status,
      commitSha: r.commitSha,
      stats: r.stats,
      error: r.error,
      startedAt: r.startedAt?.toISOString() ?? null,
      finishedAt: r.finishedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
