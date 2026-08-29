import { Badge } from "@/components/badge";
import { ConnectRepoForm } from "@/components/forms";
import { listRepos, usingDemoStore } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReposPage() {
  const repos = await listRepos();
  const demo = usingDemoStore();

  return (
    <>
      <div className="page-header">
        <div>
          <span className="page-kicker">Sources</span>
          <h1>Connect repos</h1>
          <p>
            Link GitHub repositories for scan/heal runs.{" "}
            {demo
              ? "Demo mode accepts any owner/name without calling GitHub."
              : "OAuth grants access via your GitHub installation."}
          </p>
        </div>
      </div>

      <div className="stack">
        <div className="panel interactive">
          <div className="panel-header">
            <h2>Add repository</h2>
          </div>
          <div className="panel-body">
            <ConnectRepoForm />
          </div>
        </div>

        <section className="section">
          <div className="section-head">
            <h2>Connected ({repos.filter((r) => r.connected).length})</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Docs globs</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((repo) => (
                  <tr key={repo.id}>
                    <td className="mono">{repo.fullName}</td>
                    <td>{repo.defaultBranch}</td>
                    <td>
                      <Badge
                        value={repo.connected ? "connected" : "disconnected"}
                        tone={repo.connected ? "ok" : "danger"}
                      />
                    </td>
                    <td className="muted mono">
                      {(repo.config.docs ?? ["docs/**"]).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
