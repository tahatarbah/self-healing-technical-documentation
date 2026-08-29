import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "shtd_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  githubId: string;
  demo: boolean;
};

export type SessionPayload = {
  user: SessionUser;
  exp: number;
};

function authSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-change-me-please-32chars";
}

function sign(body: string): string {
  return createHmac("sha256", authSecret()).update(body).digest("base64url");
}

function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload?.user?.id || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isGithubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.FORCE_DEMO_AUTH !== "1",
  );
}

export function demoUser(): SessionUser {
  return {
    id: "user_demo",
    login: "demo-user",
    name: "Demo User",
    avatarUrl: null,
    githubId: "10001",
    demo: true,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) {
    if (!isGithubOAuthConfigured()) {
      return { user: demoUser(), exp: Date.now() + SESSION_TTL_MS };
    }
    return null;
  }
  return decodeSession(raw);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function encodeSessionCookieValue(user: SessionUser): string {
  return encodeSession({
    user,
    exp: Date.now() + SESSION_TTL_MS,
  });
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeSessionCookieValue(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export function createOAuthState(): string {
  return randomBytes(16).toString("hex");
}

export function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export { COOKIE_NAME };
