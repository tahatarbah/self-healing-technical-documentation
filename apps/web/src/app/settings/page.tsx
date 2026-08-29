import { Badge } from "@/components/badge";
import { SettingsForm } from "@/components/forms";
import { getSession, isGithubOAuthConfigured } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, session] = await Promise.all([getSettings(), getSession()]);

  return (
    <>
      <div className="page-header">
        <div>
          <span className="page-kicker">Workspace</span>
          <h1>Settings</h1>
          <p>Docs paths, auto-merge policy, and connection status for this workspace.</p>
        </div>
      </div>

      <div className="stack">
        <section className="section">
          <div className="section-head">
            <h2>Workspace</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr>
                  <td>Mode</td>
                  <td>
                    <Badge
                      value={settings.mode}
                      tone={settings.mode === "demo" ? "warn" : "ok"}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Organization</td>
                  <td>{settings.organization?.name ?? "—"}</td>
                </tr>
                <tr>
                  <td>Signed in</td>
                  <td>
                    {session?.user.login ?? "anonymous"}
                    {session?.user.demo ? " (demo session)" : ""}
                  </td>
                </tr>
                <tr>
                  <td>GitHub OAuth</td>
                  <td>
                    <Badge
                      value={isGithubOAuthConfigured() ? "configured" : "not configured"}
                      tone={isGithubOAuthConfigured() ? "ok" : "warn"}
                    />
                  </td>
                </tr>
                <tr>
                  <td>LLM key</td>
                  <td className="muted">
                    Stored per-org in a later phase. Use env{" "}
                    <code className="mono">ANTHROPIC_API_KEY</code> for the CLI/engine.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {settings.repos.map((repo) => (
          <div className="panel interactive" key={repo.id}>
            <div className="panel-header">
              <h2 className="mono">{repo.fullName}</h2>
              <Badge
                value={repo.connected ? "connected" : "off"}
                tone={repo.connected ? "ok" : "danger"}
              />
            </div>
            <div className="panel-body">
              <SettingsForm repoId={repo.id} initial={repo.config} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
