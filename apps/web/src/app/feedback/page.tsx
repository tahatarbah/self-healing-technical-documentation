import Link from "next/link";
import { Badge } from "@/components/badge";
import { FeedbackForm } from "@/components/forms";
import { FeedbackWidget } from "@/components/feedback-widget";
import { listFeedback, listRepos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const [items, repos] = await Promise.all([listFeedback(), listRepos()]);
  const demoRepo = repos[0];

  const embedSnippet = `<script
  src="/embed.js"
  data-repo-id="${demoRepo?.id ?? "repo_demo"}"
  data-page="docs/api.md"
  defer
></script>`;

  return (
    <>
      <div className="page-header">
        <div>
          <span className="page-kicker">Readers</span>
          <h1>Feedback inbox</h1>
          <p>
            Reader “this page is wrong” reports create heal findings (`kind: feedback`)
            immediately via the API.
          </p>
        </div>
      </div>

      <div className="stack">
        <div className="panel interactive">
          <div className="panel-header">
            <h2>Report inaccuracy</h2>
          </div>
          <div className="panel-body">
            <FeedbackForm repos={repos.map((r) => ({ id: r.id, fullName: r.fullName }))} />
          </div>
        </div>

        <section className="section">
          <div className="section-head">
            <h2>Embed widget</h2>
          </div>
          <p className="muted" style={{ margin: "0 0 0.85rem" }}>
            Drop this on any docs page. Posts to <code className="mono">/api/feedback</code>{" "}
            (CORS enabled) and enqueues a finding.
          </p>
          <pre className="snippet">{embedSnippet}</pre>
          {demoRepo ? (
            <div style={{ marginTop: "1rem" }}>
              <FeedbackWidget repoId={demoRepo.id} page="docs/api.md" apiBase="" />
            </div>
          ) : null}
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Inbox ({items.length})</h2>
          </div>
          {items.length === 0 ? (
            <div className="empty">No feedback yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Repo</th>
                    <th>Page</th>
                    <th>Note</th>
                    <th>Status</th>
                    <th>Finding</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((fb) => (
                    <tr key={fb.id}>
                      <td>{fb.repoFullName}</td>
                      <td className="mono">{fb.page}</td>
                      <td>
                        {fb.quote ? (
                          <div className="muted" style={{ fontStyle: "italic" }}>
                            “{fb.quote}”
                          </div>
                        ) : null}
                        {fb.note}
                      </td>
                      <td>
                        <Badge value={fb.status} tone="info" />
                      </td>
                      <td>
                        {fb.findingId ? (
                          <Link href={`/findings?highlight=${fb.findingId}`}>{fb.findingId}</Link>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="muted">
                        {fb.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
