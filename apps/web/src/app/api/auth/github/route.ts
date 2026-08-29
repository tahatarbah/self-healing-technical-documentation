import { NextResponse } from "next/server";
import { createOAuthState, hashState, isGithubOAuthConfigured } from "@/lib/auth";

export async function GET() {
  if (!isGithubOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?oauth=missing", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    );
  }

  const state = createOAuthState();
  const clientId = process.env.GITHUB_CLIENT_ID!;
  const callback =
    process.env.GITHUB_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/callback`;

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", "read:user user:email repo");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set("shtd_oauth_state", hashState(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
