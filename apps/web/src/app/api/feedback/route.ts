import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createFeedback, listFeedback } from "@/lib/data";

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const items = await listFeedback();
  return NextResponse.json(
    {
      feedback: items.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
    },
    { headers: corsHeaders(request) },
  );
}

const CreateSchema = z.object({
  repoId: z.string().min(1).optional(),
  repoFullName: z.string().min(1).optional(),
  page: z.string().min(1),
  quote: z.string().optional(),
  note: z.string().min(1).max(4000),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  try {
    const row = await createFeedback({
      ...parsed.data,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json(
      {
        feedback: {
          id: row.id,
          repoId: row.repoId,
          page: row.page,
          quote: row.quote,
          note: row.note,
          findingId: row.findingId,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        },
        finding: {
          id: row.finding.id,
          kind: row.finding.kind,
          path: row.finding.path,
          confidence: row.finding.confidence,
          status: row.finding.status,
          message: row.finding.message,
        },
      },
      { status: 201, headers: corsHeaders(request) },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400, headers: corsHeaders(request) },
    );
  }
}
