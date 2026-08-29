import { NextResponse, type NextRequest } from "next/server";
import { encodeSessionCookieValue, hashState, type SessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stored = request.cookies.get("shtd_oauth_state")?.value;

  if (!code || !state || !stored || hashState(state) !== stored) {
    return NextResponse.redirect(new URL("/settings?oauth=invalid_state", appUrl));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?oauth=missing", appUrl));
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenJson.access_token) {
    return NextResponse.redirect(new URL("/settings?oauth=token_failed", appUrl));
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "shtd-dashboard",
    },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(new URL("/settings?oauth=user_failed", appUrl));
  }

  const ghUser = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  };

  const user: SessionUser = {
    id: `gh_${ghUser.id}`,
    githubId: String(ghUser.id),
    login: ghUser.login,
    name: ghUser.name,
    avatarUrl: ghUser.avatar_url,
    demo: false,
  };

  const res = NextResponse.redirect(new URL("/repos", appUrl));
  res.cookies.set("shtd_session", encodeSessionCookieValue(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  res.cookies.delete("shtd_oauth_state");
  return res;
}
