import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/badge";
import { getRun } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  return (
    <>
      <div className="page-header">
        <div>
          <span className="page-kicker">Run detail</span>
          <h1>Run {run.id}</h1>
          <p>
            {run.repoFullName} · trigger <strong>{run.trigger}</strong>
          </p>
        </div>
        <Link href="/runs" className="btn btn-ghost">
          All runs
        </Link>
      </div>

      <div className="metric-rail" style={{ marginBottom: "1.75rem" }} aria-label="Run metrics">
        <div className="metric">
          <span className="metric-label">Status</span>
          <span className="metric-value" style={{ fontSize: "1.05rem", paddingTop: "0.35rem" }}>
            <Badge value={run.status} />
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Findings</span>
          <span className="metric-value">{run.stats.findingsTotal}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Pages</span>
          <span className="metric-value">{run.stats.pagesScanned ?? "—"}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Duration</span>
          <span className="metric-value">
            {run.stats.durationMs ? `${Math.round(run.stats.durationMs / 1000)}s` : "—"}
          </span>
        </div>
      </div>

      {run.prLinks.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>Pull requests</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>PR</th>
                  <th>State</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {run.prLinks.map((pr) => (
                  <tr key={pr.id}>
                    <td>#{pr.number}</td>
                    <td>
                      <Badge value={pr.mergeState} tone="info" />
                    </td>
                    <td>
                      <a href={pr.url} target="_blank" rel="noreferrer">
                        {pr.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h2>Findings in this run</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Path</th>
                <th>Confidence</th>
                <th>Status</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {run.findings.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Badge value={f.kind} />
                  </td>
                  <td className="mono">{f.path}</td>
                  <td>
                    <Badge value={f.confidence} />
                  </td>
                  <td>
                    <Badge value={f.status} />
                  </td>
                  <td>
                    <Link href={`/findings?highlight=${f.id}`}>{f.evidence.summary}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
