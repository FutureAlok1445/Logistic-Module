"use client";
import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { request } from "../lib/client";
import { useSession } from "./session";
export function ShareInsights({
  summary,
  onClose,
}: {
  summary: string;
  onClose: () => void;
}) {
  const { user } = useSession();
  const [members, setMembers] = useState<{ id: string; fullName: string }[]>(
      [],
    ),
    [recipient, setRecipient] = useState(""),
    [body, setBody] = useState(summary.slice(0, 2000)),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    request<{ id: string; fullName: string }[]>("/team")
      .then(setMembers)
      .catch(() =>
        setError("Could not load colleagues. Retry by reopening this panel."),
      );
  }, []);
  return (
    <section className="text-workbook" aria-label="Share reviewed insights">
      <div className="analysis-heading">
        <div>
          <h2>
            <Send size={18} />
            Share reviewed insights
          </h2>
          <p>
            Send a reviewed summary to a colleague. Workbook access stays
            private.
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Close insight sharing"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <label className="source-text">
        Send privately to
        <select
          aria-label="Share recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        >
          <option value="">Choose a colleague</option>
          {members
            .filter((m) => m.id !== user?.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
        </select>
      </label>
      <label className="source-text">
        Review message
        <textarea
          aria-label="Insight summary message"
          value={body}
          maxLength={2000}
          rows={8}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <p className="small-note">
        Check sensitive group names and values before sending. Only this message
        is shared; the workbook is not attached.
      </p>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="alert success">
          {notice}
        </p>
      )}
      <button
        className="primary"
        disabled={busy || !recipient || !body.trim()}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await request("/messages", {
              method: "POST",
              body: JSON.stringify({ recipientId: recipient, body }),
            });
            setNotice(
              "Reviewed summary sent privately. Your colleague can read it in Team hub.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending…" : "Send reviewed summary"}
      </button>
    </section>
  );
}
