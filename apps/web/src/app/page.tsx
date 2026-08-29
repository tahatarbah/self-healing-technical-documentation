import Link from "next/link";
import { Badge } from "@/components/badge";
import { usingDemoStore, overviewStats } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await overviewStats();
  const demo = usingDemoStore();

  return (
    <>
      <section className="hero">
        <p className="page-kicker">Self-healing pipeline</p>
        <h1 className="hero-brand">Self-Healing Technical Documentation</h1>
        <p className="hero-lead">
          Detect doc drift, propose heals, and keep reader feedback in one calm review loop.
        </p>
        <div className="hero-actions">
          {stats.reviewOpen > 0 ? (
            <Link href="/review" className="btn btn-primary">
              Review {stats.reviewOpen} pending
            </Link>
          ) : (
            <Link href="/runs" className="btn btn-primary">
              Browse runs
            </Link>
          )}
          <Link href="/findings" className="btn">
            All findings
          </Link>
        </div>
        <div className="metric-rail" aria-label="Workspace metrics">
          <div className="metric">
            <span className="metric-label">Repos</span>
            <span className="metric-value">{stats.repos}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Runs</span>
            <span className="metric-value">{stats.runs}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Findings</span>
            <span className="metric-value">{stats.findings}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Review</span>
            <span className={`metric-value${stats.reviewOpen > 0 ? " accent" : ""}`}>
              {stats.reviewOpen}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Feedback</span>
            <span className="metric-value">{stats.feedbackOpen}</span>
          </div>
        </div>
      </section>

      {demo ? (
        <div className="banner">
          Running in <strong>demo mode</strong> with seeded data. Set{" "}
          <code className="mono">DATABASE_URL</code> and GitHub OAuth env vars to connect a live
          backend — see <code className="mono">apps/web/.env.example</code>.
        </div>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h2>Latest runs</h2>
          <Link href="/runs">View all</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Repo</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Findings</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {stats.latestRuns.map((run) => (
                <tr key={run.id}>
                  <td>
                    <Link href={`/runs/${run.id}`}>{run.repoFullName}</Link>
                  </td>
                  <td>
                    <Badge value={run.trigger} tone="info" />
                  </td>
                  <td>
                    <Badge value={run.status} />
                  </td>
                  <td>{run.stats.findingsTotal}</td>
                  <td className="muted">
                    {run.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
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
