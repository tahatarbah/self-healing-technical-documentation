"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ReviewActions({ findingId }: { findingId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "accept" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectNote: note || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <label>
        Reject note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Don’t auto-rewrite this section…"
          style={{ minHeight: 64 }}
        />
      </label>
      <div className="btn-row">
        <button className="btn btn-primary" disabled={busy} onClick={() => void submit("accept")}>
          Accept
        </button>
        <button className="btn btn-danger" disabled={busy} onClick={() => void submit("reject")}>
          Reject
        </button>
      </div>
      {error ? <p className="muted" style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
    </div>
  );
}

export function ConnectRepoForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to connect repo");
      }
      setFullName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={(e) => void onSubmit(e)}>
      <label>
        GitHub repository (owner/name)
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="acme-docs/sample-api"
          required
          pattern="[^/\s]+/[^/\s]+"
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Connecting…" : "Connect repo"}
      </button>
      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
    </form>
  );
}

export function FeedbackForm({
  repos,
}: {
  repos: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [repoId, setRepoId] = useState(repos[0]?.id ?? "");
  const [page, setPage] = useState("docs/");
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, page, quote: quote || undefined, note }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to submit feedback");
      }
      setQuote("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={(e) => void onSubmit(e)}>
      <label>
        Repository
        <select value={repoId} onChange={(e) => setRepoId(e.target.value)} required>
          {repos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.fullName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Page path
        <input value={page} onChange={(e) => setPage(e.target.value)} required />
      </label>
      <label>
        Quote (optional)
        <input value={quote} onChange={(e) => setQuote(e.target.value)} />
      </label>
      <label>
        What’s wrong?
        <textarea value={note} onChange={(e) => setNote(e.target.value)} required />
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy || !repoId}>
        {busy ? "Sending…" : "Submit feedback"}
      </button>
      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
    </form>
  );
}

export function SettingsForm({
  repoId,
  initial,
}: {
  repoId: string;
  initial: {
    docs?: string[];
    ignore?: string[];
    autoMerge?: { enabled?: boolean; minConfidence?: string; requireGreenCi?: boolean };
    schedule?: { enabled?: boolean; cron?: string; description?: string };
  };
}) {
  const router = useRouter();
  const [docs, setDocs] = useState((initial.docs ?? ["docs/**/*.{md,mdx}"]).join("\n"));
  const [ignore, setIgnore] = useState(
    (initial.ignore ?? ["**/node_modules/**", "**/.git/**"]).join("\n"),
  );
  const [enabled, setEnabled] = useState(Boolean(initial.autoMerge?.enabled));
  const [minConfidence, setMinConfidence] = useState(
    initial.autoMerge?.minConfidence ?? "high",
  );
  const [requireGreenCi, setRequireGreenCi] = useState(
    initial.autoMerge?.requireGreenCi ?? true,
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(
    Boolean(initial.schedule?.enabled),
  );
  const [cron, setCron] = useState(initial.schedule?.cron ?? "0 6 * * 1");
  const [scheduleDesc, setScheduleDesc] = useState(
    initial.schedule?.description ?? "Weekly Monday scan",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/repos/${repoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            docs: docs
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            ignore: ignore
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            autoMerge: {
              enabled,
              minConfidence,
              requireGreenCi,
            },
            schedule: {
              enabled: scheduleEnabled,
              cron,
              description: scheduleDesc,
            },
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage("Saved.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={(e) => void onSubmit(e)}>
      <label>
        Docs globs (one per line)
        <textarea value={docs} onChange={(e) => setDocs(e.target.value)} />
      </label>
      <label>
        Ignore patterns
        <textarea value={ignore} onChange={(e) => setIgnore(e.target.value)} />
      </label>
      <label className="form-check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enable auto-merge for high-confidence heals only
      </label>
      <label>
        Minimum confidence
        <select value={minConfidence} onChange={(e) => setMinConfidence(e.target.value)}>
          <option value="high">high (recommended)</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Engine still requires <code className="mono">high</code> for auto-merge; lower
        values only affect labeling. CI green is stubbed with{" "}
        <code className="mono">SHTD_CI_STATUS=success</code>.
      </p>
      <label className="form-check">
        <input
          type="checkbox"
          checked={requireGreenCi}
          onChange={(e) => setRequireGreenCi(e.target.checked)}
        />
        Require green CI before auto-merge
      </label>
      <hr className="form-divider" />
      <label className="form-check">
        <input
          type="checkbox"
          checked={scheduleEnabled}
          onChange={(e) => setScheduleEnabled(e.target.checked)}
        />
        Scheduled scans (cron hint for Action / external cron)
      </label>
      <label>
        Cron expression
        <input
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          placeholder="0 6 * * 1"
          className="mono"
        />
      </label>
      <label>
        Schedule description
        <input
          value={scheduleDesc}
          onChange={(e) => setScheduleDesc(e.target.value)}
        />
      </label>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Workflow YAML is owned by the Action package — mirror this cron there. CLI:{" "}
        <code className="mono">shtd scan --trigger schedule</code>
      </p>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
      {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
    </form>
  );
}

