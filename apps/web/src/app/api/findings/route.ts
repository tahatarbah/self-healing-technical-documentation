import { NextResponse, type NextRequest } from "next/server";
import { listFindings } from "@/lib/data";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const findings = await listFindings({
    kind: sp.get("kind") ?? undefined,
    confidence: sp.get("confidence") ?? undefined,
    status: sp.get("status") ?? undefined,
    repoId: sp.get("repoId") ?? undefined,
    reviewQueue: sp.get("reviewQueue") === "1",
  });

  return NextResponse.json({
    findings: findings.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
  });
}
