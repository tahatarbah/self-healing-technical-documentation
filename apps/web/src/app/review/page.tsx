import Link from "next/link";
import { Badge } from "@/components/badge";
import { ReviewActions } from "@/components/forms";
import { listFindings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const queue = await listFindings({ reviewQueue: true });

  return (
    <>
      <div className="page-header">
        <div>
          <span className="page-kicker">Human in the loop</span>
          <h1>Review queue</h1>
          <p>
            Accept or reject proposed patches. Rejections store a “don’t do this” note for the
            repo.
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="empty">
          Queue is empty. <Link href="/findings">Browse all findings</Link>
        </div>
      ) : (
        <div className="stack">
          {queue.map((f) => (
            <article key={f.id} className="finding">
              <div className="finding-top">
                <div>
                  <h3>{f.evidence.summary}</h3>
                  <div className="meta">
                    <span className="mono">{f.repoFullName}</span> ·{" "}
                    <span className="mono">{f.path}</span>
                  </div>
                </div>
                <div className="btn-row">
                  <Badge value={f.kind} />
                  <Badge value={f.confidence} />
                  <Badge value={f.status} />
                </div>
              </div>
              {f.patch ? (
                <pre className="patch">{f.patch}</pre>
              ) : (
                <p className="muted">No patch proposed — mark accepted to acknowledge, or reject.</p>
              )}
              <div className="finding-actions">
                <ReviewActions findingId={f.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
