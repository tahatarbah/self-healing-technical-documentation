import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectRepo, listRepos } from "@/lib/data";

export async function GET() {
  const repos = await listRepos();
  return NextResponse.json({
    repos: repos.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      defaultBranch: r.defaultBranch,
      connected: r.connected,
      config: r.config,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

const ConnectSchema = z.object({
  fullName: z
    .string()
    .min(3)
    .regex(/^[^/\s]+\/[^/\s]+$/, "Expected owner/name"),
  defaultBranch: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repo = await connectRepo(parsed.data);
  return NextResponse.json(
    {
      repo: {
        id: repo.id,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        connected: repo.connected,
      },
    },
    { status: 201 },
  );
}
