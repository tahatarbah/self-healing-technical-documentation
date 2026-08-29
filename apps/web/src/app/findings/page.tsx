import Link from "next/link";
import { FINDING_KINDS, CONFIDENCE_LEVELS } from "@shtd/shared";
import { Badge } from "@/components/badge";
import { listFindings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; confidence?: string; status?: string; highlight?: string }>;
}) {
  const sp = await searchParams;
  const findings = await listFindings({
    kind: sp.kind,
    confidence: sp.confidence,
    status: sp.status,
  });

  function href(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { kind: sp.kind, confidence: sp.confidence, status: sp.status, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const q = params.toString();
    return q ? `/findings?${q}` : "/findings";
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="page-kicker">Detection</span>
          <h1>Findings</h1>
          <p>Filter by kind and confidence across all heal runs.</p>
        </div>
      </div>

      <div className="filters" aria-label="Filter by kind">
        <Link href={href({ kind: undefined })} className={!sp.kind ? "active" : undefined}>
          All kinds
        </Link>
        {FINDING_KINDS.map((kind) => (
          <Link
            key={kind}
            href={href({ kind })}
            className={sp.kind === kind ? "active" : undefined}
          >
            {kind}
          </Link>
        ))}
      </div>

      <div className="filters" aria-label="Filter by confidence">
        <Link
          href={href({ confidence: undefined })}
          className={!sp.confidence ? "active" : undefined}
        >
          All confidence
        </Link>
        {CONFIDENCE_LEVELS.map((c) => (
          <Link
            key={c}
            href={href({ confidence: c })}
            className={sp.confidence === c ? "active" : undefined}
          >
            {c}
          </Link>
        ))}
      </div>

      <div className="stack">
        {findings.length === 0 ? (
          <div className="empty">No findings match these filters.</div>
        ) : (
          findings.map((f) => (
            <article
              key={f.id}
              className={`finding${sp.highlight === f.id ? " highlight" : ""}`}
              id={f.id}
            >
              <div className="finding-top">
                <div>
                  <h3>{f.evidence.summary}</h3>
                  <div className="meta">
                    <span className="mono">{f.repoFullName}</span> ·{" "}
                    <span className="mono">{f.path}</span> · run{" "}
                    <Link href={`/runs/${f.runId}`}>{f.runId}</Link>
                  </div>
                </div>
                <div className="btn-row">
                  <Badge value={f.kind} />
                  <Badge value={f.confidence} />
                  <Badge value={f.status} />
                </div>
              </div>
              {f.message ? <p className="muted" style={{ margin: "0 0 0.5rem" }}>{f.message}</p> : null}
              <div className="evidence">{JSON.stringify(f.evidence, null, 2)}</div>
              {f.patch ? <pre className="patch">{f.patch}</pre> : null}
            </article>
          ))
        )}
      </div>
    </>
  );
}
