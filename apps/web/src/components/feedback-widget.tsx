"use client";

import { useState, type FormEvent } from "react";

export type FeedbackWidgetProps = {
  /** Dashboard origin, e.g. https://docs-heal.example.com */
  apiBase?: string;
  repoId?: string;
  repoFullName?: string;
  /** Docs page path reported with the finding */
  page: string;
  className?: string;
};

/**
 * React “Report inaccuracy” control for docs sites embedding the dashboard API.
 */
export function FeedbackWidget({
  apiBase = "",
  repoId,
  repoFullName,
  page,
  className,
}: FeedbackWidgetProps) {
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const endpoint = `${apiBase.replace(/\/$/, "")}/api/feedback`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          note,
          quote: quote || undefined,
          repoId,
          repoFullName,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        finding?: { id?: string };
      };
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : `Request failed (${res.status})`,
        );
      }
      setStatus(
        body.finding?.id
          ? `Thanks — queued as finding ${body.finding.id}`
          : "Thanks — feedback received",
      );
      setQuote("");
      setNote("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className={`embed-preview${className ? ` ${className}` : ""}`}>
      <summary>Report inaccuracy</summary>
      <form className="form" onSubmit={(e) => void onSubmit(e)} style={{ marginTop: "0.75rem" }}>
        <label>
          Quoted text (optional)
          <input value={quote} onChange={(e) => setQuote(e.target.value)} />
        </label>
        <label>
          What’s wrong?
          <textarea value={note} onChange={(e) => setNote(e.target.value)} required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || !note.trim()}>
          {busy ? "Sending…" : "Send"}
        </button>
        {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
      </form>
    </details>
  );
}
