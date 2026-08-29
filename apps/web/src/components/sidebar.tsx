import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/repos", label: "Repos" },
  { href: "/runs", label: "Runs" },
  { href: "/findings", label: "Findings" },
  { href: "/review", label: "Review" },
  { href: "/feedback", label: "Feedback" },
  { href: "/settings", label: "Settings" },
] as const;

export function Sidebar({
  pathname,
  user,
  demoMode,
}: {
  pathname: string;
  user: SessionUser | null;
  demoMode: boolean;
}) {
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <span className="brand-mark">SHTD</span>
        <span className="brand-sub">Self-healing docs</span>
      </Link>
      <nav className="nav" aria-label="Primary">
        {LINKS.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        {user ? (
          <>
            <div>
              Signed in as <strong>{user.login}</strong>
              {user.demo ? " · demo" : ""}
            </div>
            {!user.demo ? (
              <div style={{ marginTop: "0.55rem" }}>
                <Link href="/api/auth/logout">Sign out</Link>
              </div>
            ) : demoMode ? (
              <div style={{ marginTop: "0.55rem" }}>
                <Link href="/api/auth/github">Connect GitHub</Link>
              </div>
            ) : null}
          </>
        ) : (
          <Link href="/api/auth/github">Sign in with GitHub</Link>
        )}
      </div>
    </aside>
  );
}
