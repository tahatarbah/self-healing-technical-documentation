import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ConfidenceLevelSchema } from "@shtd/shared";
import { getRepo, updateRepo } from "@/lib/data";

const PatchSchema = z.object({
  connected: z.boolean().optional(),
  defaultBranch: z.string().min(1).optional(),
  config: z
    .object({
      docs: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
      openapi: z.array(z.string()).optional(),
      autoMerge: z
        .object({
          enabled: z.boolean().optional(),
          minConfidence: ConfidenceLevelSchema.optional(),
          requireGreenCi: z.boolean().optional(),
        })
        .optional(),
      schedule: z
        .object({
          enabled: z.boolean().optional(),
          cron: z.string().optional(),
          description: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    repo: {
      ...repo,
      createdAt: repo.createdAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repo = await updateRepo(id, parsed.data);
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    repo: {
      id: repo.id,
      fullName: repo.fullName,
      connected: repo.connected,
      config: repo.config,
    },
  });
}
