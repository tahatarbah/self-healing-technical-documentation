import Link from "next/link";
import { Badge } from "@/components/badge";
import { listRuns } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await listRuns();

  return (
    <>
      <div className="page-header">
        <div>
          <span className="page-kicker">History</span>
          <h1>Runs</h1>
          <p>Scan and heal history across connected repositories.</p>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{runs.length} runs</h2>
        </div>
        {runs.length === 0 ? (
          <div className="empty">No runs yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Repo</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Findings</th>
                  <th>Commit</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link href={`/runs/${run.id}`} className="mono">
                        {run.id}
                      </Link>
                    </td>
                    <td>{run.repoFullName}</td>
                    <td>
                      <Badge value={run.trigger} tone="info" />
                    </td>
                    <td>
                      <Badge value={run.status} />
                    </td>
                    <td>{run.stats.findingsTotal}</td>
                    <td className="mono muted">
                      {run.commitSha ? run.commitSha.slice(0, 8) : "—"}
                    </td>
                    <td className="muted">
                      {(run.startedAt ?? run.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
