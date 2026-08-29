import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { JetBrains_Mono, Sora, Syne } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { getSession, isGithubOAuthConfigured } from "@/lib/auth";
import { usingDemoStore } from "@/lib/data";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SHTD — Self-Healing Technical Documentation",
  description: "Dashboard for doc drift detection, heal runs, and review",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "/";
  const demoMode = usingDemoStore() || !isGithubOAuthConfigured();

  return (
    <html lang="en" className={`${syne.variable} ${sora.variable} ${jetbrains.variable}`}>
      <body>
        <div className="app-shell">
          <Sidebar pathname={pathname} user={session?.user ?? null} demoMode={demoMode} />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
