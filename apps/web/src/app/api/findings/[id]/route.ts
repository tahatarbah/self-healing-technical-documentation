import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getFinding, reviewFinding } from "@/lib/data";

const ReviewSchema = z.object({
  action: z.enum(["accept", "reject"]),
  rejectNote: z.string().max(2000).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const finding = await getFinding(id);
  if (!finding) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    finding: {
      ...finding,
      createdAt: finding.createdAt.toISOString(),
      updatedAt: finding.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const finding = await reviewFinding(id, parsed.data.action, parsed.data.rejectNote);
  if (!finding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    finding: {
      id: finding.id,
      status: finding.status,
      rejectNote: finding.rejectNote,
      updatedAt: finding.updatedAt.toISOString(),
    },
  });
}
